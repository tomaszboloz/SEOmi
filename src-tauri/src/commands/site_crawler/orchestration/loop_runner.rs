use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

use super::super::{
    control::{CrawlControl, CrawlProgress},
    models::RejectedCrawlUrl,
    robots::RobotsRule,
    robots_matching::robots_deciding_rule,
    transport::crawl_deadline_reached,
};
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
    let parallelism = prefetch_parallelism(&setup.config, robots_crawl_delay);

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
        let Some((current_url, depth)) = state
            .prefetched_order
            .pop_front()
            .or_else(|| state.queue.pop_front())
        else {
            break;
        };
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
        let elapsed_seconds = setup.start_time.elapsed().as_secs_f64();
        let pages_per_second = if elapsed_seconds > 0.0 {
            state.pages.len() as f64 / elapsed_seconds
        } else {
            0.0
        };
        let _ = app.emit(
            "crawl-progress",
            CrawlProgress {
                run_id: setup.run_id.clone(),
                current_url: Some(current_url.clone()),
                discovered: state.visited.len(),
                completed: state.pages.len(),
                queued: state.queue.len() + state.prefetched_order.len(),
                cancelled: false,
                paused: false,
                elapsed_ms: setup.start_time.elapsed().as_millis() as u64,
                pages_per_second,
            },
        );

        let (resp, page_duration) =
            fetch_page_step(app, control, setup, state, robots_crawl_delay, &current_url).await;

        match resp {
            Ok(fetched) => {
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
            }
            Err(e) => {
                if !handle_page_error(setup, state, &current_url, depth, page_duration, e) {
                    break;
                }
            }
        }

        prefetch_next_window(app, control, setup, state, robots_rules, parallelism).await;
    }
}
