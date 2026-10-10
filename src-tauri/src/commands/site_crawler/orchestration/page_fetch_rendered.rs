use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};

use super::super::{
    control::{wait_for_crawl_cancellation, CrawlControl},
    fetch_types::{CrawlFetchFailure, FetchedResponse},
    render_fetch::{fetch_rendered_page, RenderRequestScope, WebviewRenderer},
    render_health::remaining_run_time,
};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;
use crate::commands::rendered_crawler::RenderOptions;

/// Renderer settings of a crawl; every renderer window is opened with them.
pub fn render_options(setup: &CrawlSetup) -> RenderOptions {
    RenderOptions {
        user_agent: Some(setup.ua.clone()),
        cookie: setup.rendered_cookie.clone(),
        wait_for_selector: setup
            .config
            .render_wait_for_selector
            .as_deref()
            .map(str::trim)
            .filter(|selector| !selector.is_empty())
            .map(|selector| selector.chars().take(512).collect()),
        wait_delay_ms: setup.config.render_wait_delay_ms.unwrap_or(0).min(10_000),
        lazy_scroll_cycles: setup.config.render_lazy_scroll_cycles.unwrap_or(0).min(40),
        allowed_hosts: setup.config.allowed_hosts.clone(),
    }
}

/// Fetch one page in rendered mode outside a prefetch window, reusing an idle
/// renderer window when there is one.
pub async fn fetch_rendered_step<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
    current_url: &str,
    crawl_delay: Option<Duration>,
    page_started_at: Instant,
) -> Result<FetchedResponse, CrawlFetchFailure> {
    if control.is_cancelled(&setup.run_id) {
        return Err(CrawlFetchFailure {
            kind: "cancelled".into(),
            message: "Crawl was cancelled during page rendering.".into(),
        });
    }
    let remaining = remaining_run_time(setup.start_time, setup.max_run_seconds);
    if remaining.is_zero() {
        state.timed_out = true;
        return Err(CrawlFetchFailure {
            kind: "timeout".into(),
            message: "Rendered page exceeded the remaining crawl time.".into(),
        });
    }
    let mut renderer = WebviewRenderer::new(
        app,
        &setup.base_host,
        &setup.config,
        &render_options(setup),
        state.rendered_sessions.pop(),
    );
    let outcome = {
        let render = fetch_rendered_page(
            &setup.client,
            current_url,
            RenderRequestScope::new(&setup.base_host, setup.max_redirects)
                .with_retry_context(setup.retry_context()),
            &setup.config,
            state.render_health.rendering_enabled(),
            &mut renderer,
            crawl_delay.map(|delay| (control, setup.run_id.as_str(), page_started_at, delay)),
        );
        tokio::select! {
            result = render => result,
            _ = wait_for_crawl_cancellation(control, &setup.run_id) => Err(CrawlFetchFailure {
                kind: "cancelled".into(),
                message: "Crawl was cancelled during page rendering.".into(),
            }),
            // A single page is already bounded by the capture timeout. This
            // branch only enforces the remaining run budget, so a slow page
            // cannot be mistaken for an exhausted crawl.
            _ = tokio::time::sleep(remaining) => {
                state.timed_out = true;
                Err(CrawlFetchFailure {
                    kind: "timeout".into(),
                    message: "Rendered page exceeded the remaining crawl time.".into(),
                })
            }
        }
    };
    state.rendered_sessions.extend(renderer.session.take());
    outcome
}
