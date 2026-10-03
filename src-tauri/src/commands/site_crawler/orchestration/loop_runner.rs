use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::super::{
    control::{CrawlControl, CrawlProgress},
    models::RejectedCrawlUrl,
    prefetch::prefetch_http_pages,
    robots::RobotsRule,
    robots_matching::{robots_allows, robots_deciding_rule},
    transport::crawl_deadline_reached,
};
use super::page_assembler::assemble_page_summary;
use super::page_error::handle_page_error;
use super::page_fetch::fetch_page_step;
use super::selectors::CrawlSelectors;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub async fn run_crawl_loop(
    app: &AppHandle,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
    selectors: &CrawlSelectors,
    robots_rules: &[RobotsRule],
    robots_crawl_delay: Option<Duration>,
) {
    let html_parallelism = if setup.config.crawl_mode == "http" && robots_crawl_delay.is_none() {
        setup
            .config
            .max_concurrent_requests
            .unwrap_or(1)
            .clamp(1, 16)
    } else {
        1
    };

    while let Some((current_url, depth)) = state
        .prefetched_order
        .pop_front()
        .or_else(|| state.queue.pop_front())
    {
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
        if setup.resume_completed_urls.contains(&current_url) {
            continue;
        }

        let Ok(current_parsed) = url::Url::parse(&current_url) else {
            continue;
        };
        if setup.config.respect_robots && !robots_allows(&current_parsed, robots_rules) {
            state.robots_blocked_count += 1;
            let reason = robots_deciding_rule(&current_parsed, robots_rules)
                .map(|r| format!("Blocked by robots.txt Disallow rule: {}", r.path))
                .unwrap_or_else(|| "Blocked by robots.txt Disallow rule".into());
            state.rejected_urls.push(RejectedCrawlUrl {
                url: current_url,
                reason,
            });
            continue;
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

        if html_parallelism > 1
            && !state.timed_out
            && !control.is_cancelled(&setup.run_id)
            && !crawl_deadline_reached(setup.start_time, setup.max_run_seconds)
        {
            prefetch_http_pages(
                &mut state.queue,
                &mut state.prefetched_order,
                &mut state.prefetched_responses,
                html_parallelism,
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
            )
            .await;
        }
    }
}
