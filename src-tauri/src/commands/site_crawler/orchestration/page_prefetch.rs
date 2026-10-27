use std::time::Duration;
use tauri::{AppHandle, Runtime};

use super::super::{
    control::CrawlControl, models::CrawlConfig, prefetch::prefetch_http_pages_with_context,
    render_health::MAX_RENDER_SESSIONS, robots::RobotsRule, transport::crawl_deadline_reached,
};
use super::rendered_prefetch::prefetch_rendered_pages;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

/// Pages fetched ahead of the sequential loop: HTTP requests in HTTP mode,
/// renderer windows in rendered mode. A robots crawl-delay keeps the crawl
/// strictly sequential.
pub fn prefetch_parallelism(config: &CrawlConfig, robots_crawl_delay: Option<Duration>) -> usize {
    if robots_crawl_delay.is_some() {
        return 1;
    }
    let requested = config.max_concurrent_requests.unwrap_or(1);
    match config.crawl_mode.as_str() {
        "http" => requested.clamp(1, 16),
        "browser-rendered" => requested.clamp(1, MAX_RENDER_SESSIONS),
        _ => 1,
    }
}

/// Fetch the next window of queued pages concurrently, unless the crawl is
/// sequential, finished, cancelled or out of time.
pub async fn prefetch_next_window<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
    robots_rules: &[RobotsRule],
    parallelism: usize,
) {
    if parallelism < 2
        || state.timed_out
        || control.is_cancelled(&setup.run_id)
        || crawl_deadline_reached(setup.start_time, setup.max_run_seconds)
    {
        return;
    }
    if setup.config.crawl_mode == "browser-rendered" {
        prefetch_rendered_pages(app, control, setup, state, parallelism, robots_rules).await;
        return;
    }
    prefetch_http_pages_with_context(
        &mut state.queue,
        &mut state.prefetched_order,
        &mut state.prefetched_responses,
        parallelism,
        setup.limit,
        state.pages.len(),
        &setup.client,
        &setup.base_host,
        setup.config.allow_subdomains,
        setup.config.scope_path.as_deref(),
        &setup.config.allowed_hosts,
        setup.max_redirects,
        &setup.config,
        robots_rules,
        setup.retry_context(),
    )
    .await;
}
