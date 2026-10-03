use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewWindowBuilder},
    AppHandle,
};
use tokio::sync::mpsc;

use super::models::{CaptureEvent, RenderOptions, CAPTURE_SCHEME, MAX_CAPTURE_CHANNEL_EVENTS};
use super::navigation::{is_allowed_navigation, parse_capture_chunk};
use super::scripts::{capture_script, cookie_bootstrap_script};
use super::session::RenderedCrawlerSession;
use crate::{
    services::browser_proxy::BrowserRequestProxy, utils::url_validator::validate_and_normalize_url,
};

impl RenderedCrawlerSession {
    pub async fn open(
        app: &AppHandle,
        start_url: &str,
        base_host: &str,
        allow_subdomains: bool,
        scope_path: Option<&str>,
        options: RenderOptions,
    ) -> Result<Self, String> {
        let start_url = validate_and_normalize_url(start_url).map_err(|error| error.to_string())?;
        let nonce = uuid::Uuid::new_v4().simple().to_string();
        let label = format!("rendered-crawl-{}", uuid::Uuid::new_v4().simple());
        let proxy = BrowserRequestProxy::start()
            .await
            .map_err(|error| format!("Unable to start isolated renderer proxy: {error}"))?;
        let proxy_url = proxy.url();
        let base_host = base_host.to_ascii_lowercase();
        let scope_path = scope_path.map(str::to_owned);
        let sequence = Arc::new(AtomicU64::new(0));
        let (sender, receiver) = mpsc::channel(MAX_CAPTURE_CHANNEL_EVENTS);

        let build_app = app.clone();
        let build_nonce = nonce.clone();
        let build_host = base_host.clone();
        let build_scope = scope_path.clone();
        let build_sequence = sequence.clone();
        let build_sender = sender.clone();
        let build_options = options.clone();
        let build_user_agent = options.user_agent.clone();
        let build_cookie = options.cookie.clone();
        let navigation_nonce = build_nonce.clone();
        let navigation_sender = build_sender.clone();
        let start_url_for_window = start_url.clone();
        let (built_tx, built_rx) = tokio::sync::oneshot::channel();

        app.run_on_main_thread(move || {
            let mut builder = WebviewWindowBuilder::new(
                &build_app,
                label,
                tauri::WebviewUrl::External(start_url_for_window),
            )
            .title("SEOmi renderer")
            .visible(false)
            .incognito(true)
            .on_new_window(|_, _| NewWindowResponse::Deny)
            .on_navigation(move |url| {
                if url.scheme() == CAPTURE_SCHEME {
                    if let Some(chunk) = parse_capture_chunk(url, &navigation_nonce) {
                        let _ = navigation_sender.blocking_send(CaptureEvent::Chunk(chunk));
                    } else if url.host_str() == Some(navigation_nonce.as_str()) {
                        if let Some(sequence) = url.path().strip_suffix("/error").and_then(|value| value.trim_start_matches('/').parse::<u64>().ok()) {
                            let _ = navigation_sender.blocking_send(CaptureEvent::TransferFailed(sequence));
                        }
                    }
                    return false;
                }
                is_allowed_navigation(url, &build_host, allow_subdomains, build_scope.as_deref())
            })
            .on_page_load(move |window, payload| {
                if payload.event() != PageLoadEvent::Finished {
                    return;
                }
                if window.url().ok().as_ref() != Some(payload.url()) {
                    return;
                }
                let current_sequence = build_sequence.fetch_add(1, Ordering::Relaxed) + 1;
                if build_sender
                    .blocking_send(CaptureEvent::PageReady(current_sequence))
                    .is_err()
                {
                    return;
                }
                let script = capture_script(&build_nonce, current_sequence, &build_options);
                let _ = window.eval(&script);
            });

            if let Some(user_agent) = build_user_agent.as_deref() {
                builder = builder.user_agent(user_agent);
            }
            if let Some(cookie) = build_cookie.as_deref() {
                builder = builder.initialization_script(cookie_bootstrap_script(cookie));
            }

            #[cfg(target_os = "windows")]
            {
                let args = format!(
                    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --proxy-server=http://{}:{} --proxy-bypass-list=<-loopback>",
                    proxy_url.host_str().unwrap_or("127.0.0.1"),
                    proxy_url.port().unwrap_or_default()
                );
                builder = builder.additional_browser_args(&args);
            }

            #[cfg(target_os = "macos")]
            {
                builder = builder.proxy_url(proxy_url);
            }

            let result = builder
                .build()
                .map_err(|error| format!("Unable to create isolated renderer: {error}"));
            let _ = built_tx.send(result);
        })
        .map_err(|error| format!("Unable to schedule renderer creation: {error}"))?;

        let window = built_rx
            .await
            .map_err(|_| "Renderer creation was interrupted.".to_string())??;

        Ok(Self {
            window,
            proxy: Some(proxy),
            receiver,
            nonce,
            requested_url: start_url.to_string(),
            base_host,
            allow_subdomains,
            scope_path,
        })
    }
}
