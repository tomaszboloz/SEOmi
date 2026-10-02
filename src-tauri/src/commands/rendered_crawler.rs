use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::time::Duration;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewWindowBuilder},
    AppHandle,
};
use tokio::sync::mpsc;
use tokio::time::timeout;
use url::Url;

use crate::{
    services::browser_proxy::BrowserRequestProxy, utils::url_validator::validate_and_normalize_url,
};

const CAPTURE_SCHEME: &str = "seomi-capture";
const MAX_CAPTURE_HTML_CHARS: usize = 1_000_000;
const MAX_CAPTURE_CHUNK_BYTES: usize = 12_000;
const MAX_CAPTURE_CHUNKS: usize = 768;
const MAX_CAPTURE_CHANNEL_EVENTS: usize = (MAX_CAPTURE_CHUNKS * 2) + 32;
const PAGE_RENDER_TIMEOUT: Duration = Duration::from_secs(60);
const NETWORK_IDLE_MAX_WAIT_MS: u64 = 5_000;
const NETWORK_IDLE_QUIET_MS: u64 = 500;
const NETWORK_IDLE_POLL_MS: u64 = 100;
const DOM_IDLE_MAX_WAIT_MS: u64 = 5_000;
const DOM_IDLE_QUIET_MS: u64 = 500;
const PREVIEW_SELECTOR_MAX_CHARS: usize = 512;
const PREVIEW_NEEDLE_MAX_CHARS: usize = 2_048;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPageSnapshot {
    pub requested_url: String,
    pub final_url: String,
    pub http_status: Option<u16>,
    pub content_type: String,
    pub charset: String,
    pub html: String,
    pub html_truncated: bool,
    pub navigation_time_ms: Option<u64>,
    /// Best-effort lab observations collected inside the rendered page. These
    /// are not field/CrUX values and remain absent when the browser does not
    /// expose the relevant PerformanceObserver entry type.
    pub lcp_ms: Option<u64>,
    pub inp_ms: Option<u64>,
    pub cls: Option<f64>,
    pub failed_resource_urls: Vec<String>,
    pub console_errors: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum RenderedArtifactKind {
    Screenshot,
    Pdf,
}

impl RenderedArtifactKind {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "screenshot" | "png" => Ok(Self::Screenshot),
            "pdf" => Ok(Self::Pdf),
            _ => Err("Rendered artifact kind must be screenshot or pdf.".into()),
        }
    }

    pub(crate) fn content_type(self) -> &'static str {
        match self {
            Self::Screenshot => "image/png",
            Self::Pdf => "application/pdf",
        }
    }

    pub(crate) fn extension(self) -> &'static str {
        match self {
            Self::Screenshot => "png",
            Self::Pdf => "pdf",
        }
    }

    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Screenshot => "screenshot",
            Self::Pdf => "pdf",
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct RenderOptions {
    pub user_agent: Option<String>,
    /// Request-profile cookies that may be bootstrapped into the isolated
    /// browser context. HTTP-only cookies cannot be created from JavaScript;
    /// this is intentionally a cookie-header subset, not a full cookie-jar
    /// import.
    pub cookie: Option<String>,
    pub wait_for_selector: Option<String>,
    pub wait_delay_ms: u64,
    pub lazy_scroll_cycles: usize,
}

#[derive(Debug, Deserialize)]
struct CapturedPayload {
    page_url: String,
    http_status: Option<u16>,
    content_type: String,
    charset: String,
    html: String,
    html_truncated: bool,
    navigation_time_ms: Option<u64>,
    lcp_ms: Option<u64>,
    inp_ms: Option<u64>,
    cls: Option<f64>,
    failed_resource_urls: Vec<String>,
    console_errors: Vec<String>,
}

#[derive(Debug)]
enum CaptureEvent {
    PageReady(u64),
    Chunk(CaptureChunk),
    TransferFailed(u64),
}

#[derive(Debug)]
struct CaptureChunk {
    sequence: u64,
    index: usize,
    total: usize,
    data: String,
}

pub struct RenderedCrawlerSession {
    window: tauri::WebviewWindow,
    proxy: Option<BrowserRequestProxy>,
    receiver: mpsc::Receiver<CaptureEvent>,
    nonce: String,
    requested_url: String,
    base_host: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
}

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
                        // Navigation callbacks are synchronous. Blocking here
                        // is bounded by the channel capacity and prevents a
                        // dropped chunk from turning into a 60 second timeout.
                        let _ = navigation_sender.blocking_send(CaptureEvent::Chunk(chunk));
                    } else if url.host_str() == Some(navigation_nonce.as_str()) {
                        if let Some(sequence) = url.path().strip_suffix("/error").and_then(|value| value.trim_start_matches('/').parse::<u64>().ok()) {
                            let _ = navigation_sender.blocking_send(CaptureEvent::TransferFailed(sequence));
                        }
                    }
                    return false;
                }
                is_allowed_navigation(
                    url,
                    &build_host,
                    allow_subdomains,
                    build_scope.as_deref(),
                )
            })
            .on_page_load(move |window, payload| {
                if payload.event() != PageLoadEvent::Finished {
                    return;
                }
                // Only capture the top-level document. Embedded frames can be
                // inspected from the parent DOM but must not replace the page
                // currently being crawled.
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
                // WebView2 implicitly bypasses loopback destinations unless
                // this Chromium switch removes that default. Keep the built-in
                // safety switches because custom browser args replace Wry's
                // defaults and the proxy configuration itself.
                let args = format!(
                    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --proxy-server=http://{}:{} --proxy-bypass-list=<-loopback>",
                    proxy_url.host_str().unwrap_or("127.0.0.1"),
                    proxy_url.port().unwrap_or_default()
                );
                builder = builder.additional_browser_args(&args);
            }

            #[cfg(target_os = "macos")]
            {
                // Requires Tauri's `macos-proxy` feature (macOS 14+); the
                // Network.framework proxy config applies to this data store.
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

    /// Capture the page loaded by `open`, or navigate to another URL in the
    /// same isolated browser context and return its rendered DOM snapshot.
    pub async fn capture(&mut self, url: &str) -> Result<RenderedPageSnapshot, String> {
        let normalized = validate_and_normalize_url(url).map_err(|error| error.to_string())?;
        if !is_allowed_navigation(
            &normalized,
            &self.base_host,
            self.allow_subdomains,
            self.scope_path.as_deref(),
        ) {
            return Err("The rendered URL is outside the configured crawl scope.".into());
        }

        let requested_url = normalized.to_string();
        if requested_url != self.requested_url {
            self.window
                .navigate(normalized)
                .map_err(|error| format!("Unable to navigate renderer: {error}"))?;
            self.requested_url = requested_url.clone();
        }

        let capture = timeout(PAGE_RENDER_TIMEOUT, self.receive_page_capture())
            .await
            .map_err(|_| "Rendered page capture timed out after 60 seconds.".to_string())??;
        Ok(RenderedPageSnapshot {
            requested_url,
            final_url: capture.page_url,
            http_status: capture.http_status,
            content_type: capture.content_type,
            charset: capture.charset,
            html: capture.html,
            html_truncated: capture.html_truncated,
            navigation_time_ms: capture.navigation_time_ms,
            lcp_ms: capture.lcp_ms,
            inp_ms: capture.inp_ms,
            cls: capture.cls,
            failed_resource_urls: capture.failed_resource_urls,
            console_errors: capture.console_errors,
        })
    }

    pub(crate) async fn capture_artifact(
        &self,
        kind: RenderedArtifactKind,
    ) -> Result<Vec<u8>, String> {
        crate::commands::rendered_artifacts::capture_window_artifact(&self.window, kind).await
    }

    async fn receive_page_capture(&mut self) -> Result<CapturedPayload, String> {
        let sequence = loop {
            match self.receiver.recv().await {
                Some(CaptureEvent::PageReady(sequence)) => break sequence,
                Some(_) => continue,
                None => return Err("Renderer capture channel closed.".into()),
            }
        };

        let mut total_chunks = None;
        let mut chunks: Vec<Option<String>> = Vec::new();
        let mut received = 0usize;
        while received < total_chunks.unwrap_or(usize::MAX) {
            // Once capture starts, a lost transfer must not consume the full
            // page-load timeout. JS retries an unacknowledged fragment in 100ms.
            let transfer_timeout = if received == 0 {
                PAGE_RENDER_TIMEOUT
            } else {
                Duration::from_secs(3)
            };
            match timeout(transfer_timeout, self.receiver.recv())
                .await
                .map_err(|_| "Renderer capture transfer stalled.".to_string())?
            {
                Some(CaptureEvent::PageReady(next_sequence)) if next_sequence > sequence => {
                    return Err(
                        "The page navigated again before its rendered snapshot completed.".into(),
                    );
                }
                Some(CaptureEvent::TransferFailed(failed_sequence))
                    if failed_sequence == sequence =>
                {
                    return Err("Renderer capture transfer failed after bounded retries.".into());
                }
                Some(CaptureEvent::Chunk(chunk)) if chunk.sequence == sequence => {
                    if chunk.total == 0
                        || chunk.total > MAX_CAPTURE_CHUNKS
                        || chunk.index >= chunk.total
                        || chunk.data.len() > MAX_CAPTURE_CHUNK_BYTES
                    {
                        return Err("Renderer returned an invalid capture chunk.".into());
                    }
                    if total_chunks.is_some_and(|total| total != chunk.total) {
                        return Err(
                            "Renderer capture chunks disagree about the total count.".into()
                        );
                    }
                    if total_chunks.is_none() {
                        total_chunks = Some(chunk.total);
                        chunks.resize(chunk.total, None);
                    }
                    let acknowledgement = format!(
                        "window.dispatchEvent(new CustomEvent('seomi-capture-ack', {{detail: {{nonce: {}, sequence: {}, index: {}}}}}));",
                        serde_json::to_string(&self.nonce).map_err(|error| error.to_string())?, sequence, chunk.index
                    );
                    if chunks[chunk.index].is_none() {
                        chunks[chunk.index] = Some(chunk.data);
                        received += 1;
                    }
                    self.window.eval(&acknowledgement).map_err(|error| {
                        format!("Unable to acknowledge renderer capture: {error}")
                    })?;
                }
                Some(_) => continue,
                None => return Err("Renderer capture channel closed before completion.".into()),
            }
        }

        let encoded = chunks
            .into_iter()
            .map(|chunk| chunk.ok_or_else(|| "Renderer snapshot is missing a chunk.".to_string()))
            .collect::<Result<String, _>>()?;
        let bytes = URL_SAFE_NO_PAD
            .decode(encoded)
            .map_err(|_| "Renderer snapshot is not valid base64url.".to_string())?;
        serde_json::from_slice(&bytes)
            .map_err(|error| format!("Renderer returned invalid snapshot JSON: {error}"))
    }

    pub fn close(mut self) {
        // The renderer is incognito and is discarded after the run. Clear
        // script-visible state before closing as an additional defense for
        // platforms whose WebView keeps a short-lived page process alive.
        let _ = self.window.eval(CLEAR_SESSION_SCRIPT);
        let _ = self.window.close();
        self.proxy.take();
    }
}

const CLEAR_SESSION_SCRIPT: &str = r#"(() => {
  try {
    for (const part of String(document.cookie || '').split(';')) {
      const name = part.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  } catch (_) {}
})();"#;

fn is_allowed_navigation(
    url: &Url,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
) -> bool {
    if url.scheme() != "http" && url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let Ok(validated) = validate_and_normalize_url(url.as_str()) else {
        return false;
    };
    let Some(host) = validated.host_str().map(str::to_ascii_lowercase) else {
        return false;
    };
    let base_host = base_host.to_ascii_lowercase();
    let host_in_scope =
        host == base_host || (allow_subdomains && host.ends_with(&format!(".{base_host}")));
    if !host_in_scope {
        return false;
    }
    let Some(scope_path) = scope_path.filter(|path| !path.trim().is_empty()) else {
        return true;
    };
    let path = validated.path();
    let normalized_scope = scope_path.trim_end_matches('/');
    path == normalized_scope
        || path
            .strip_prefix(normalized_scope)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn parse_capture_chunk(url: &Url, nonce: &str) -> Option<CaptureChunk> {
    if url.scheme() != CAPTURE_SCHEME || url.host_str() != Some(nonce) {
        return None;
    }
    let mut parts = url.path_segments()?;
    let sequence = parts.next()?.parse().ok()?;
    let index = parts.next()?.parse().ok()?;
    let total = parts.next()?.parse().ok()?;
    if parts.next().is_some() || total == 0 || total > MAX_CAPTURE_CHUNKS || index >= total {
        return None;
    }
    let data = url
        .query_pairs()
        .find_map(|(name, value)| (name == "data").then(|| value.into_owned()))?;
    if data.is_empty() || data.len() > MAX_CAPTURE_CHUNK_BYTES {
        return None;
    }
    Some(CaptureChunk {
        sequence,
        index,
        total,
        data,
    })
}

fn cookie_bootstrap_script(cookie_header: &str) -> String {
    let encoded = serde_json::to_string(cookie_header).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(() => {{
  const header = {encoded};
  for (const part of String(header || '').split(';')) {{
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name || !value || /[=;\s]/.test(name)) continue;
    try {{ document.cookie = `${{name}}=${{value}}; path=/`; }} catch (_) {{}}
  }}
}})();"#
    )
}

fn capture_script(nonce: &str, sequence: u64, options: &RenderOptions) -> String {
    let nonce = serde_json::to_string(nonce).unwrap_or_else(|_| "\"\"".into());
    let selector =
        serde_json::to_string(&options.wait_for_selector).unwrap_or_else(|_| "null".into());
    let sequence = sequence.min(u64::MAX - 1);
    let wait_delay_ms = options.wait_delay_ms.min(10_000);
    let scroll_cycles = options.lazy_scroll_cycles.min(40);
    format!(
        r#"(() => {{
  const nonce = {nonce};
  const sequence = {sequence};
  const waitSelector = {selector};
  const waitDelayMs = {wait_delay_ms};
  const scrollCycles = {scroll_cycles};
  const scrollPauseMs = 250;
  if (window.__seomiCaptureSequence === sequence) return;
  window.__seomiCaptureSequence = sequence;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitForNetworkIdle = async () => {{
    if (typeof PerformanceObserver !== 'function') return;
    let lastResourceActivity = Date.now();
    let observer = null;
    try {{
      observer = new PerformanceObserver((list) => {{
        if (list.getEntries().length) lastResourceActivity = Date.now();
      }});
      observer.observe({{ type: 'resource', buffered: true }});
    }} catch (_) {{
      return;
    }}
    const deadline = Date.now() + {NETWORK_IDLE_MAX_WAIT_MS};
    while (Date.now() < deadline && Date.now() - lastResourceActivity < {NETWORK_IDLE_QUIET_MS}) {{
      await wait({NETWORK_IDLE_POLL_MS});
    }}
    observer.disconnect();
  }};
  const waitForDomIdle = async () => {{
    if (typeof MutationObserver !== 'function' || !document.documentElement) return;
    let lastMutation = Date.now();
    const observer = new MutationObserver(() => {{ lastMutation = Date.now(); }});
    try {{
      observer.observe(document.documentElement, {{ childList: true, subtree: true, attributes: true, characterData: true }});
    }} catch (_) {{
      observer.disconnect();
      return;
    }}
    const deadline = Date.now() + {DOM_IDLE_MAX_WAIT_MS};
    while (Date.now() < deadline && Date.now() - lastMutation < {DOM_IDLE_QUIET_MS}) {{
      await wait({NETWORK_IDLE_POLL_MS});
    }}
    observer.disconnect();
  }};
  (async () => {{
    const consoleErrors = [];
    const failedResourceUrls = [];
    const originalConsoleError = typeof console !== 'undefined' && typeof console.error === 'function'
      ? console.error.bind(console)
      : null;
    const onConsoleError = (...args) => {{
      const message = args.map((value) => {{
        try {{ return typeof value === 'string' ? value : JSON.stringify(value); }} catch (_) {{ return String(value); }}
      }}).join(' ').slice(0, 512);
      if (message) consoleErrors.push(message);
    }};
    if (originalConsoleError && typeof console !== 'undefined') {{
      try {{
        console.error = (...args) => {{
          onConsoleError(...args);
          try {{ originalConsoleError(...args); }} catch (_) {{}}
        }};
      }} catch (_) {{}}
    }}
    const onError = (event) => {{
      const target = event.target;
      if (target && target !== window && (target.src || target.href)) {{
        failedResourceUrls.push(String(target.src || target.href).slice(0, 2048));
      }} else if (event.message) {{
        consoleErrors.push(String(event.message).slice(0, 512));
      }}
    }};
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', (event) => {{
      consoleErrors.push(String(event.reason || 'unhandled promise rejection').slice(0, 512));
    }});
    if (waitSelector) {{
      const waitUntil = Date.now() + 8000;
      while (Date.now() < waitUntil) {{
        try {{ if (document.querySelector(waitSelector)) break; }} catch (_) {{ break; }}
        await wait(100);
      }}
    }}
    if (waitDelayMs) await wait(waitDelayMs);
    await waitForNetworkIdle();
    await waitForDomIdle();
    if (scrollCycles > 0) {{
      let mutationCount = 0;
      const observer = typeof MutationObserver === 'function'
        ? new MutationObserver(() => {{ mutationCount += 1; }})
        : null;
      if (observer) observer.observe(document.documentElement, {{ childList: true, subtree: true, attributes: true, characterData: true }});
      let stableScrollCycles = 0;
      for (let index = 0; index < scrollCycles; index += 1) {{
        const previousHeight = document.documentElement ? document.documentElement.scrollHeight : document.body.scrollHeight;
        const previousMutationCount = mutationCount;
        window.scrollTo(0, previousHeight);
        await wait(scrollPauseMs);
        const currentHeight = document.documentElement ? document.documentElement.scrollHeight : document.body.scrollHeight;
        if (observer && currentHeight <= previousHeight && mutationCount === previousMutationCount) {{
          stableScrollCycles += 1;
          if (stableScrollCycles >= 3) break;
        }} else {{
          stableScrollCycles = 0;
        }}
      }}
      observer?.disconnect();
      await waitForNetworkIdle();
      await waitForDomIdle();
    }}
    window.scrollTo(0, 0);
    let largestContentfulPaintMs = null;
    let interactionToNextPaintMs = null;
    const layoutShiftEntries = [];
    const observers = [];
    const observe = (type, callback, options = {{}}) => {{
      if (typeof PerformanceObserver !== 'function') return;
      try {{
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({{ type, buffered: true, ...options }});
        observers.push(observer);
      }} catch (_) {{}}
    }};
    observe('largest-contentful-paint', (entries) => {{
      for (const entry of entries) {{
        if (Number.isFinite(entry.startTime)) largestContentfulPaintMs = Math.max(largestContentfulPaintMs || 0, entry.startTime);
      }}
    }});
    observe('layout-shift', (entries) => {{
      for (const entry of entries) {{
        if (!entry.hadRecentInput && Number.isFinite(entry.value) && Number.isFinite(entry.startTime)) layoutShiftEntries.push({{ startTime: entry.startTime, value: entry.value }});
      }}
    }});
    observe('event', (entries) => {{
      for (const entry of entries) {{
        if (entry.name !== 'pointerdown' && entry.name !== 'click' && entry.name !== 'keydown') continue;
        if (Number.isFinite(entry.duration)) interactionToNextPaintMs = Math.max(interactionToNextPaintMs || 0, entry.duration);
      }}
    }}, {{ durationThreshold: 16 }});
    await wait(50);
    let clsValue = null;
    if (layoutShiftEntries.length) {{
      let sessionValue = 0;
      let sessionStart = 0;
      let previousTime = 0;
      for (const entry of layoutShiftEntries) {{
        if (sessionValue === 0 || entry.startTime - previousTime > 1000 || entry.startTime - sessionStart > 5000) {{
          sessionValue = entry.value;
          sessionStart = entry.startTime;
        }} else {{
          sessionValue += entry.value;
        }}
        previousTime = entry.startTime;
        clsValue = Math.max(clsValue || 0, sessionValue);
      }}
    }}
    const navigation = performance.getEntriesByType('navigation')[0];
    const page = {{
      page_url: location.href,
      http_status: navigation && navigation.responseStatus > 0 ? navigation.responseStatus : null,
      content_type: document.contentType || 'text/html',
      charset: document.characterSet || 'UTF-8',
      html: document.documentElement ? document.documentElement.outerHTML.slice(0, {MAX_CAPTURE_HTML_CHARS}) : '',
      html_truncated: Boolean(document.documentElement && document.documentElement.outerHTML.length > {MAX_CAPTURE_HTML_CHARS}),
      navigation_time_ms: navigation && navigation.duration ? Math.round(navigation.duration) : null,
      lcp_ms: Number.isFinite(largestContentfulPaintMs) ? Math.round(largestContentfulPaintMs) : null,
      inp_ms: Number.isFinite(interactionToNextPaintMs) ? Math.round(interactionToNextPaintMs) : null,
      cls: Number.isFinite(clsValue) ? clsValue : null,
      failed_resource_urls: Array.from(new Set(failedResourceUrls)).slice(0, 500),
      console_errors: Array.from(new Set(consoleErrors)).slice(0, 100),
    }};
    for (const observer of observers) observer.disconnect();
    window.removeEventListener('error', onError, true);
    if (originalConsoleError && typeof console !== 'undefined') {{
      try {{ console.error = originalConsoleError; }} catch (_) {{}}
    }}
    const encoded = (() => {{
      const bytes = new TextEncoder().encode(JSON.stringify(page));
      let binary = '';
      for (let start = 0; start < bytes.length; start += 0x8000) {{
        binary += String.fromCharCode(...bytes.subarray(start, Math.min(start + 0x8000, bytes.length)));
      }}
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }})();
    {transport}
    await sendCaptureChunks(encoded, nonce, sequence, {MAX_CAPTURE_CHUNK_BYTES}, {MAX_CAPTURE_CHUNKS});
  }})().catch(() => {{
    location.href = 'seomi-capture://' + nonce + '/' + sequence + '/error';
  }});
}})();"#,
        transport = include_str!("render_capture_transport.js"),
    )
}

#[tauri::command]
pub async fn render_crawl_page(
    app: AppHandle,
    url: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
    wait_for_selector: Option<String>,
    wait_delay_ms: Option<u64>,
    lazy_scroll_cycles: Option<usize>,
) -> Result<RenderedPageSnapshot, String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Rendered URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let options = RenderOptions {
        user_agent: None,
        cookie: None,
        wait_for_selector: wait_for_selector
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
        wait_delay_ms: wait_delay_ms.unwrap_or(0).min(10_000),
        lazy_scroll_cycles: lazy_scroll_cycles.unwrap_or(0).min(40),
    };
    let mut session = RenderedCrawlerSession::open(
        &app,
        target.as_str(),
        &base_host,
        allow_subdomains,
        scope_path.as_deref(),
        options,
    )
    .await?;
    let result = session.capture(target.as_str()).await;
    session.close();
    result
}

fn normalize_preview_value(value: &str, field: &str, max_chars: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("{field} cannot be empty."));
    }
    if value.chars().count() > max_chars {
        return Err(format!(
            "{field} exceeds the {max_chars}-character safety limit."
        ));
    }
    if value.chars().any(|character| character == '\0') {
        return Err(format!("{field} contains an invalid null character."));
    }
    Ok(value.to_string())
}

#[tauri::command]
pub async fn open_rendered_element_preview(
    app: AppHandle,
    url: String,
    selector: String,
    needle: Option<String>,
    dom_index: Option<usize>,
    preview_title: String,
    not_found_message: String,
) -> Result<(), String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let selector =
        normalize_preview_value(&selector, "Preview selector", PREVIEW_SELECTOR_MAX_CHARS)?;
    let needle = needle
        .as_deref()
        .map(|value| normalize_preview_value(value, "Preview match text", PREVIEW_NEEDLE_MAX_CHARS))
        .transpose()?;
    let preview_title = normalize_preview_value(
        &preview_title,
        "Preview window title",
        PREVIEW_SELECTOR_MAX_CHARS,
    )?;
    let not_found_message = normalize_preview_value(
        &not_found_message,
        "Preview not-found message",
        PREVIEW_NEEDLE_MAX_CHARS,
    )?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Preview URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let label = format!("audit-preview-{}", uuid::Uuid::new_v4().simple());
    let title = preview_title;
    let selector_json = serde_json::to_string(&selector)
        .map_err(|error| format!("Unable to encode preview selector: {error}"))?;
    let needle_json = serde_json::to_string(&needle)
        .map_err(|error| format!("Unable to encode preview match text: {error}"))?;
    let dom_index_json = serde_json::to_string(&dom_index)
        .map_err(|error| format!("Unable to encode preview DOM index: {error}"))?;
    let not_found_message_json = serde_json::to_string(&not_found_message)
        .map_err(|error| format!("Unable to encode preview not-found message: {error}"))?;
    let preview_script = format!(
        r#"(() => {{
  const selector = {selector_json};
  const needle = {needle_json};
  const domIndex = {dom_index_json};
  const notFoundMessage = {not_found_message_json};
  const candidates = (() => {{ try {{ return Array.from(document.querySelectorAll(selector)); }} catch (_) {{ return []; }} }})();
  const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const indexedMatch = Number.isInteger(domIndex) && domIndex >= 0 && domIndex < candidates.length
    ? candidates[domIndex]
    : null;
  const match = indexedMatch || (needle
    ? candidates.find((element) => normalized(element.textContent) === normalized(needle)
      || normalized(element.getAttribute('href')) === normalized(needle)
      || normalized(element.getAttribute('src')) === normalized(needle)
      || normalized(element.href) === normalized(needle))
    : candidates[0]);
  const styleId = 'seomi-audit-preview-style';
  document.getElementById(styleId)?.remove();
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = '[data-seomi-audit-preview] {{ outline: 4px solid #34d399 !important; outline-offset: 6px !important; box-shadow: 0 0 0 10px rgba(52,211,153,.18) !important; }}';
  document.head.appendChild(style);
  document.querySelectorAll('[data-seomi-audit-preview]').forEach((element) => element.removeAttribute('data-seomi-audit-preview'));
  if (match) {{
    match.setAttribute('data-seomi-audit-preview', 'true');
    match.scrollIntoView({{ block: 'center', inline: 'nearest', behavior: 'auto' }});
  }} else {{
    const notice = document.createElement('div');
    notice.textContent = notFoundMessage;
    notice.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:420px;padding:12px 16px;border:1px solid #f59e0b;border-radius:8px;background:#0f172a;color:#fde68a;font:13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 6000);
  }}
}})();"#
    );
    let (sender, receiver) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let build_app = app.clone();
    let navigation_host = base_host.clone();
    let build_url = target.clone();
    app.run_on_main_thread(move || {
        let result =
            WebviewWindowBuilder::new(&build_app, label, tauri::WebviewUrl::External(build_url))
                .title(title)
                .visible(true)
                .inner_size(1200.0, 800.0)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_navigation(move |navigation_url| {
                    is_allowed_navigation(navigation_url, &navigation_host, false, None)
                })
                .on_page_load(move |window, payload| {
                    if payload.event() == PageLoadEvent::Finished {
                        let _ = window.eval(&preview_script);
                    }
                })
                .build()
                .map(|_| ())
                .map_err(|error| format!("Unable to open rendered element preview: {error}"));
        let _ = sender.send(result);
    })
    .map_err(|error| format!("Unable to schedule rendered element preview: {error}"))?;
    receiver
        .await
        .map_err(|_| "Rendered element preview was interrupted.".to_string())??;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPageArtifact {
    pub requested_url: String,
    pub final_url: String,
    pub run_id: Option<String>,
    pub captured_at: String,
    pub artifact_type: String,
    pub content_type: String,
    pub file_name: String,
    pub bytes: usize,
    pub data_base64: String,
    pub renderer_platform: String,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn capture_rendered_artifact(
    app: AppHandle,
    url: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
    wait_for_selector: Option<String>,
    wait_delay_ms: Option<u64>,
    lazy_scroll_cycles: Option<usize>,
    kind: String,
    run_id: Option<String>,
) -> Result<RenderedPageArtifact, String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let artifact_kind = RenderedArtifactKind::parse(&kind)?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Rendered URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let options = RenderOptions {
        user_agent: None,
        cookie: None,
        wait_for_selector: wait_for_selector
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
        wait_delay_ms: wait_delay_ms.unwrap_or(0).min(10_000),
        lazy_scroll_cycles: lazy_scroll_cycles.unwrap_or(0).min(40),
    };
    let mut session = RenderedCrawlerSession::open(
        &app,
        target.as_str(),
        &base_host,
        allow_subdomains,
        scope_path.as_deref(),
        options,
    )
    .await?;
    let snapshot = session.capture(target.as_str()).await;
    let result = match snapshot {
        Ok(snapshot) => match session.capture_artifact(artifact_kind).await {
            Ok(bytes) => {
                let captured_at = chrono::Utc::now().to_rfc3339();
                let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
                Ok(RenderedPageArtifact {
                    requested_url: snapshot.requested_url,
                    final_url: snapshot.final_url,
                    run_id: run_id
                        .map(|value| value.trim().chars().take(128).collect())
                        .filter(|value: &String| !value.is_empty()),
                    captured_at,
                    artifact_type: artifact_kind.label().to_string(),
                    content_type: artifact_kind.content_type().to_string(),
                    file_name: format!(
                        "rendered-page-{timestamp}-{}.{}",
                        artifact_kind.label(),
                        artifact_kind.extension()
                    ),
                    bytes: bytes.len(),
                    data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
                    renderer_platform: crate::commands::rendered_artifacts::renderer_platform()
                        .to_string(),
                })
            }
            Err(error) => Err(error),
        },
        Err(error) => Err(error),
    };
    session.close();
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rendered_navigation_is_confined_to_http_scope_and_path_boundary() {
        let base = Url::parse("https://www.example.test/articles").unwrap();
        assert!(is_allowed_navigation(
            &base,
            "www.example.test",
            false,
            Some("/articles")
        ));
        assert!(is_allowed_navigation(
            &Url::parse("https://www.example.test/articles/seo").unwrap(),
            "www.example.test",
            false,
            Some("/articles")
        ));
        assert!(!is_allowed_navigation(
            &Url::parse("https://www.example.test/articles-evil").unwrap(),
            "www.example.test",
            false,
            Some("/articles")
        ));
        assert!(!is_allowed_navigation(
            &Url::parse("https://elsewhere.test/articles").unwrap(),
            "www.example.test",
            true,
            None
        ));
        assert!(!is_allowed_navigation(
            &Url::parse("file:///etc/passwd").unwrap(),
            "www.example.test",
            false,
            None
        ));
        assert!(!is_allowed_navigation(
            &Url::parse("https://user@example.test/articles").unwrap(),
            "example.test",
            false,
            None
        ));
    }

    #[test]
    fn capture_chunk_requires_nonce_valid_bounds_and_payload() {
        let nonce = "aabbccddeeff00112233445566778899";
        let valid = Url::parse(&format!(
            "seomi-capture://{nonce}/3/0/2?data=eyJvayI6dHJ1ZX0"
        ))
        .unwrap();
        let chunk = parse_capture_chunk(&valid, nonce).unwrap();
        assert_eq!(chunk.sequence, 3);
        assert_eq!(chunk.total, 2);
        assert_eq!(chunk.data, "eyJvayI6dHJ1ZX0");

        assert!(parse_capture_chunk(&valid, "different-nonce").is_none());
        assert!(parse_capture_chunk(
            &Url::parse(&format!("seomi-capture://{nonce}/3/2/2?data=abc")).unwrap(),
            nonce,
        )
        .is_none());
        assert!(parse_capture_chunk(
            &Url::parse(&format!("seomi-capture://{nonce}/3/0/2?data=")).unwrap(),
            nonce,
        )
        .is_none());
    }

    #[test]
    fn renderer_wait_and_scroll_limits_are_applied_to_the_injected_script() {
        let script = capture_script(
            "token",
            4,
            &RenderOptions {
                user_agent: None,
                cookie: None,
                wait_for_selector: Some("main".into()),
                wait_delay_ms: u64::MAX,
                lazy_scroll_cycles: usize::MAX,
            },
        );
        assert!(script.contains("const waitDelayMs = 10000;"));
        assert!(script.contains("const scrollCycles = 40;"));
        assert!(script.contains("const scrollPauseMs = 250;"));
        assert!(script.contains("const waitForNetworkIdle = async"));
        assert!(script.contains("type: 'resource', buffered: true"));
        assert!(script.contains("Date.now() - lastResourceActivity < 500"));
        assert!(script.contains("await waitForNetworkIdle();"));
        assert!(script.contains("const waitForDomIdle = async"));
        assert!(script.contains("Date.now() - lastMutation < 500"));
        assert!(script.contains("childList: true, subtree: true, attributes: true"));
        assert!(script.contains("const originalConsoleError"));
        assert!(script.contains("console.error = (...args)"));
        assert!(script.contains("console.error = originalConsoleError"));
        assert!(script.contains("document.querySelector(waitSelector)"));
        assert!(script.contains("const observer = typeof MutationObserver === 'function'"));
        assert!(script.contains("if (stableScrollCycles >= 3) break;"));
        assert!(script.contains("observer?.disconnect();"));
        assert!(script.contains("lcp_ms:"));
        assert!(script.contains("inp_ms:"));
        assert!(script.contains("cls:"));
        assert!(script.contains("PerformanceObserver"));
        assert!(script.contains("durationThreshold: 16"));
        assert!(script.contains("entry.startTime - previousTime > 1000"));
        assert!(script.contains("seomi-capture://"));
    }

    #[test]
    fn capture_script_base64url_regexes_are_valid_javascript() {
        // The script lives in a raw string, so a doubled backslash reaches the
        // page verbatim: `/\\//g` parses as a regex followed by `/ g` and
        // throws a ReferenceError before any fragment is sent.
        let script = capture_script("nonce", 1, &RenderOptions::default());
        assert!(script.contains(r"replace(/\+/g, '-').replace(/\//g, '_')"));
        assert!(!script.contains(r"/\\"));
    }

    #[test]
    fn capture_script_uses_acknowledged_transfer_instead_of_overlapping_navigations() {
        let script = capture_script("nonce", 1, &RenderOptions::default());
        assert!(script.contains("await sendCaptureChunks(encoded, nonce, sequence"));
        assert!(script.contains("seomi-capture-ack"));
        assert!(!script.contains("index * 4"));
    }

    #[test]
    fn cookie_bootstrap_script_uses_cookie_pairs_without_logging_values() {
        let script = cookie_bootstrap_script("session=opaque; consent=yes");

        assert!(script.contains("const header ="));
        assert!(script.contains("document.cookie"));
        assert!(script.contains("path=/"));
        assert!(!script.contains("console.log"));
        assert!(!script.contains("console.error"));
    }

    #[test]
    fn render_options_default_to_no_cookie_bootstrap() {
        assert!(RenderOptions::default().cookie.is_none());
    }

    #[test]
    fn preview_values_are_bounded_and_trimmed() {
        assert_eq!(
            normalize_preview_value("  h1  ", "selector", 10).unwrap(),
            "h1"
        );
        assert!(normalize_preview_value("", "selector", 10).is_err());
        assert!(normalize_preview_value("123456", "selector", 5).is_err());
        assert!(normalize_preview_value("bad\0selector", "selector", 50).is_err());
    }

    #[test]
    fn rendered_artifact_kind_has_stable_desktop_metadata() {
        let screenshot = RenderedArtifactKind::parse("PNG").unwrap();
        assert_eq!(screenshot.label(), "screenshot");
        assert_eq!(screenshot.content_type(), "image/png");
        assert_eq!(screenshot.extension(), "png");

        let pdf = RenderedArtifactKind::parse(" pdf ").unwrap();
        assert_eq!(pdf.label(), "pdf");
        assert_eq!(pdf.content_type(), "application/pdf");
        assert_eq!(pdf.extension(), "pdf");
        assert!(RenderedArtifactKind::parse("html").is_err());
    }
}
