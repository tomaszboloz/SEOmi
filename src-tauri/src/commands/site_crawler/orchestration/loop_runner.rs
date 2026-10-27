use std::time::Duration;
use tauri::{AppHandle, Runtime};

use super::super::{
    control::CrawlControl, models::RejectedCrawlUrl, robots::RobotsRule,
    robots_matching::robots_deciding_rule, transport::crawl_deadline_reached,
};
use super::loop_runner_progress::emit_crawl_progress;
use super::native_collector::NativeCrawlCollector;
use super::page_assembler::assemble_page_summary;
use super::page_error::handle_page_error;
use super::page_fetch::fetch_page_step;
use super::page_prefetch::{prefetch_next_window, prefetch_parallelism};
use super::selectors::CrawlSelectors;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub async fn run_crawl_loop<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
    selectors: &CrawlSelectors,
    robots_rules: &[RobotsRule],
    robots_crawl_delay: Option<Duration>,
) {
    let _ = run_crawl_loop_with_collector(
        app,
        control,
        setup,
        state,
        selectors,
        robots_rules,
        robots_crawl_delay,
        &mut None,
    )
    .await;
}

#[allow(clippy::too_many_arguments)]
pub async fn run_crawl_loop_with_collector<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
    selectors: &CrawlSelectors,
    robots_rules: &[RobotsRule],
    robots_crawl_delay: Option<Duration>,
    collector: &mut Option<NativeCrawlCollector>,
) -> Result<(), String> {
    let parallelism = prefetch_parallelism(&setup.config, robots_crawl_delay);
    if let Some(col) = collector.as_mut() {
        let config = serde_json::to_value(&setup.config).map_err(|e| e.to_string())?;
        col.record_started(&setup.normalized_start_url.to_string(), &config)?;
    }

    loop {
        if state.prefetched_order.is_empty() && state.queue.is_empty() {
            break;
        }
        if crawl_deadline_reached(setup.start_time, setup.max_run_seconds) {
            state.timed_out = true;
            break;
        }
        if !control.wait_until_resumed(&setup.run_id).await {
            break;
        }
        if state.pages.len() >= setup.limit {
            break;
        }
        // The guard at the top of the loop proved one of the queues is non-empty and
        // `state` is exclusively borrowed, so a pop cannot come back empty here.
        let (current_url, depth) = state
            .prefetched_order
            .pop_front()
            .or_else(|| state.queue.pop_front())
            .expect("loop guard guarantees queued work");
        if setup.resume_completed_urls.contains(&current_url) {
            continue;
        }

        let Ok(current_parsed) = url::Url::parse(&current_url) else {
            continue;
        };
        if setup.config.respect_robots {
            if let Some(rule) = robots_deciding_rule(&current_parsed, robots_rules) {
                if !rule.allow {
                    state.robots_blocked_count += 1;
                    state.rejected_urls.push(RejectedCrawlUrl {
                        url: current_url,
                        reason: format!("Blocked by robots.txt Disallow rule: {}", rule.path),
                    });
                    continue;
                }
            }
        }

        if control.is_cancelled(&setup.run_id) {
            break;
        }
        emit_crawl_progress(app, setup, state, &current_url);

        let (resp, page_duration) =
            fetch_page_step(app, control, setup, state, robots_crawl_delay, &current_url).await;

        match resp {
            Ok(fetched) => {
                let pages_before = state.pages.len();
                let _ = assemble_page_summary(
                    fetched,
                    page_duration,
                    &current_url,
                    depth,
                    selectors,
                    setup,
                    state,
                )
                .await;
                if state.pages.len() > pages_before {
                    if let (Some(col), Some(page)) = (collector.as_mut(), state.pages.last()) {
                        col.record_page(page)?;
                    }
                }
            }
            Err(e) => {
                let pages_before = state.pages.len();
                if !handle_page_error(setup, state, &current_url, depth, page_duration, e) {
                    break;
                }
                if state.pages.len() > pages_before {
                    if let (Some(col), Some(page)) = (collector.as_mut(), state.pages.last()) {
                        col.record_page(page)?;
                    }
                }
            }
        }

        prefetch_next_window(app, control, setup, state, robots_rules, parallelism).await;
    }
    Ok(())
}
