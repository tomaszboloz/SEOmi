use std::collections::{HashMap, VecDeque};
use tauri::{AppHandle, Runtime};
use tokio::task::JoinSet;

use super::super::{
    control::{wait_for_crawl_cancellation, CrawlControl},
    fetch_types::CrawlFetchFailure,
    models::CrawlConfig,
    render_fetch::{fetch_rendered_page, RenderRequestScope, WebviewRenderer},
    render_health::remaining_run_time,
    robots::RobotsRule,
    robots_matching::robots_allows,
};
use super::page_fetch_rendered::render_options;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

/// Take the next window of queued URLs in crawl order, leaving robots-blocked
/// entries in the ordered list so the main loop records the deciding rule.
pub fn take_prefetch_window(
    queue: &mut VecDeque<(String, usize)>,
    prefetched_order: &mut VecDeque<(String, usize)>,
    slots: usize,
    config: &CrawlConfig,
    robots_rules: &[RobotsRule],
) -> Vec<String> {
    let mut candidates = Vec::with_capacity(slots);
    for _ in 0..slots {
        let Some((url, depth)) = queue.pop_front() else {
            break;
        };
        prefetched_order.push_back((url.clone(), depth));
        if config.respect_robots
            && url::Url::parse(&url)
                .ok()
                .is_some_and(|parsed| !robots_allows(&parsed, robots_rules))
        {
            continue;
        }
        candidates.push(url);
    }
    candidates
}

/// Render a bounded window of pages concurrently, one hidden renderer window
/// per page. Parsing and queue expansion stay in the main loop and keep the
/// crawl order deterministic, exactly as with `prefetch_http_pages`.
pub async fn prefetch_rendered_pages<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
    parallelism: usize,
    robots_rules: &[RobotsRule],
) {
    let planned = state.pages.len() + state.prefetched_order.len();
    let slots = parallelism
        .min(super::super::render_health::MAX_RENDER_SESSIONS)
        .min(setup.limit.saturating_sub(planned));
    if slots < 2 || state.queue.is_empty() {
        return;
    }
    if control.is_cancelled(&setup.run_id) {
        return;
    }
    if remaining_run_time(setup.start_time, setup.max_run_seconds).is_zero() {
        state.timed_out = true;
        return;
    }
    let candidates = take_prefetch_window(
        &mut state.queue,
        &mut state.prefetched_order,
        slots,
        &setup.config,
        robots_rules,
    );
    let options = render_options(setup);
    let rendering_enabled = state.render_health.rendering_enabled();

    let mut tasks = JoinSet::new();
    // A panicked task cannot return its URL, so it is looked up by task id.
    let mut task_urls: HashMap<tokio::task::Id, String> = HashMap::new();
    for url in candidates {
        let idle_session = state.rendered_sessions.pop();
        let mut renderer =
            WebviewRenderer::new(app, &setup.base_host, &setup.config, &options, idle_session);
        let client = setup.client.clone();
        let base_host = setup.base_host.clone();
        let config = setup.config.clone();
        let max_redirects = setup.max_redirects;
        let retry_context = setup.retry_context();
        let task_url = url.clone();
        let handle = tasks.spawn(async move {
            let result = fetch_rendered_page(
                &client,
                &url,
                RenderRequestScope::new(&base_host, max_redirects)
                    .with_retry_context(retry_context),
                &config,
                rendering_enabled,
                &mut renderer,
                None,
            )
            .await;
            (url, renderer.session.take(), result)
        });
        task_urls.insert(handle.id(), task_url);
    }

    let deadline = tokio::time::sleep(remaining_run_time(setup.start_time, setup.max_run_seconds));
    tokio::pin!(deadline);
    loop {
        let joined = tokio::select! {
            joined = tasks.join_next() => joined,
            // Dropping an aborted task closes its renderer window. The main
            // loop observes the same cancellation or deadline right after.
            _ = wait_for_crawl_cancellation(control, &setup.run_id) => {
                tasks.abort_all();
                break;
            }
            _ = &mut deadline => {
                tasks.abort_all();
                break;
            }
        };
        match joined {
            None => break,
            Some(Ok((url, session, result))) => {
                state.rendered_sessions.extend(session);
                state.prefetched_responses.insert(url, result);
            }
            Some(Err(error)) if error.is_cancelled() => continue,
            Some(Err(error)) => {
                log::error!("rendered prefetch task failed: {error}");
                if let Some(url) = task_urls.remove(&error.id()) {
                    let failure = CrawlFetchFailure {
                        kind: "prefetch_task".into(),
                        message: error.to_string(),
                    };
                    state.prefetched_responses.insert(url, Err(failure));
                }
            }
        }
    }
}
