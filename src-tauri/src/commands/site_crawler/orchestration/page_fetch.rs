use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};

use super::super::{
    control::CrawlControl,
    crawl_delay::wait_for_crawl_delay,
    fetch_types::{CrawlFetchFailure, FetchedResponse},
    transport::request_with_safe_redirects_with_context,
};
use super::page_fetch_rendered::fetch_rendered_step;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub async fn fetch_page_step<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
    robots_crawl_delay: Option<Duration>,
    current_url: &str,
) -> (Result<FetchedResponse, CrawlFetchFailure>, u64) {
    if let (Some(delay), Some(last_request_at)) = (robots_crawl_delay, state.last_page_request_at) {
        if !wait_for_crawl_delay(control, &setup.run_id, last_request_at, delay).await {
            return (
                Err(CrawlFetchFailure {
                    kind: "cancelled".into(),
                    message: "Crawl was cancelled during crawl-delay pause.".into(),
                }),
                0,
            );
        }
    }
    let page_start = Instant::now();
    state.last_page_request_at = Some(page_start);
    let prefetched_response = state.prefetched_responses.remove(current_url);
    let resp: Result<FetchedResponse, CrawlFetchFailure> =
        if let Some(response) = prefetched_response {
            response
        } else if setup.config.crawl_mode == "browser-rendered" {
            fetch_rendered_step(
                app,
                control,
                setup,
                state,
                current_url,
                robots_crawl_delay,
                page_start,
            )
            .await
        } else {
            request_with_safe_redirects_with_context(
                &setup.client,
                current_url,
                &setup.base_host,
                setup.config.allow_subdomains,
                setup.config.scope_path.as_deref(),
                &setup.config.allowed_hosts,
                setup.max_redirects,
                &setup.config,
                setup.retry_context(),
            )
            .await
            .map_err(|error| CrawlFetchFailure {
                kind: error.kind(),
                message: error.to_string(),
            })
        };
    if setup.config.crawl_mode == "browser-rendered" && robots_crawl_delay.is_some() {
        // The browser navigation is a second transport request. Start the
        // next crawl-delay interval after that request has been gated.
        state.last_page_request_at = Some(Instant::now());
    }
    let page_duration = resp
        .as_ref()
        .ok()
        .and_then(|fetched| fetched.request_duration_ms)
        .unwrap_or_else(|| page_start.elapsed().as_millis() as u64);
    (resp, page_duration)
}
