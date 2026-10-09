use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};
#[path = "render_fetch_scope.rs"]
mod scope;
pub(crate) use scope::RenderRequestScope;

use super::control::CrawlControl;
use super::crawl_delay::wait_for_crawl_delay;
use super::fetch_data::read_fetched_page_data_with_context;
use super::fetch_types::{CrawlFetchFailure, FetchedPageBody, FetchedResponse};
use super::models::CrawlConfig;
use super::render_decision::{is_renderable_response, render_or_fallback, PageRenderer};
use super::transport::request_with_safe_redirects_with_context;
use crate::commands::rendered_crawler::{
    RenderOptions, RenderedCrawlerSession, RenderedPageSnapshot,
};

/// Renders in a hidden webview, reusing an idle session when it has one.
pub(crate) struct WebviewRenderer<R: Runtime = tauri::Wry> {
    app: AppHandle<R>,
    base_host: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
    options: RenderOptions,
    /// Present only while idle and healthy. It is taken for the duration of a
    /// capture, so an abandoned or failed capture drops it, which closes its
    /// window instead of leaving stale load events for the next page.
    pub(crate) session: Option<RenderedCrawlerSession<R>>,
}

impl<R: Runtime> WebviewRenderer<R> {
    pub(crate) fn new(
        app: &AppHandle<R>,
        base_host: &str,
        config: &CrawlConfig,
        options: &RenderOptions,
        session: Option<RenderedCrawlerSession<R>>,
    ) -> Self {
        Self {
            app: app.clone(),
            base_host: base_host.to_owned(),
            allow_subdomains: config.allow_subdomains,
            scope_path: config.scope_path.clone(),
            options: options.clone(),
            session,
        }
    }
}

impl<R: Runtime> PageRenderer for WebviewRenderer<R> {
    async fn render(&mut self, url: &str) -> Result<RenderedPageSnapshot, String> {
        let mut session = match self.session.take() {
            Some(session) => session,
            None => {
                RenderedCrawlerSession::open(
                    &self.app,
                    url,
                    &self.base_host,
                    self.allow_subdomains,
                    self.scope_path.as_deref(),
                    self.options.clone(),
                )
                .await?
            }
        };
        let snapshot = session.capture(url).await?;
        self.session = Some(session);
        Ok(snapshot)
    }
}

/// Fetch one page in rendered mode. The mode is a hybrid: the HTTP response
/// supplies what a browser does not expose (status line, response headers,
/// redirect hops) and decides whether rendering makes sense at all, while the
/// browser supplies the DOM after JavaScript ran. Downloads, errors and
/// non-HTML responses therefore never reach a renderer window.
pub(crate) async fn fetch_rendered_page<R: PageRenderer>(
    client: &reqwest::Client,
    url: &str,
    scope: RenderRequestScope<'_>,
    config: &CrawlConfig,
    rendering_enabled: bool,
    renderer: &mut R,
    render_gate: Option<(&CrawlControl, &str, Instant, Duration)>,
) -> Result<FetchedResponse, CrawlFetchFailure> {
    let max_response_bytes = config
        .max_response_bytes
        .unwrap_or(5_000_000)
        .clamp(1_024, 50_000_000);
    let FetchedResponse {
        response,
        final_url,
        redirect_chain,
        redirect_stopped_reason,
        request_duration_ms,
        retry_count,
    } = request_with_safe_redirects_with_context(
        client,
        url,
        scope.base_host,
        config.allow_subdomains,
        config.scope_path.as_deref(),
        &config.allowed_hosts,
        scope.max_redirects,
        config,
        scope.retry_context.clone(),
    )
    .await
    .map_err(|error| CrawlFetchFailure {
        kind: error.kind(),
        message: error.to_string(),
    })?;
    let http = read_fetched_page_data_with_context(
        response,
        max_response_bytes,
        Some(&scope.retry_context),
    )
    .await;
    if rendering_enabled && is_renderable_response(&http) {
        if let Some((control, run_id, request_started_at, delay)) = render_gate {
            if !wait_for_crawl_delay(control, run_id, request_started_at, delay).await {
                return Err(CrawlFetchFailure {
                    kind: "cancelled".into(),
                    message: "Crawl was cancelled during rendered crawl-delay pause.".into(),
                });
            }
        }
    }
    let (data, final_url) = render_or_fallback(
        http,
        final_url,
        rendering_enabled,
        max_response_bytes,
        renderer,
    )
    .await;
    Ok(FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(data)),
        final_url,
        redirect_chain,
        redirect_stopped_reason,
        request_duration_ms,
        retry_count,
    })
}
