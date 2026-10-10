use std::time::{Duration, Instant};
use tauri::Runtime;
use tokio::task::JoinSet;

use super::super::{
    control::CrawlControl, crawl_delay::wait_for_crawl_delay, models::CrawledResource,
    resource_fetch::fetch_resource_candidate_with_context, transport::crawl_deadline_reached,
};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

async fn can_fetch_resources<R: Runtime>(
    setup: &CrawlSetup,
    control: &CrawlControl,
    state: &mut CrawlLoopState<R>,
) -> bool {
    if crawl_deadline_reached(setup.start_time, setup.max_run_seconds) {
        state.timed_out = true;
        return false;
    }
    if !control.wait_until_resumed(&setup.run_id).await {
        return false;
    }
    if crawl_deadline_reached(setup.start_time, setup.max_run_seconds) {
        state.timed_out = true;
        return false;
    }
    true
}

pub async fn crawl_secondary_resources<R: Runtime>(
    setup: &CrawlSetup,
    control: &CrawlControl,
    state: &mut CrawlLoopState<R>,
    robots_crawl_delay: Option<Duration>,
) -> (Vec<CrawledResource>, bool) {
    let max_resource_requests = setup
        .config
        .max_resource_requests
        .unwrap_or(250)
        .clamp(1, 1_000);
    let mut ordered_resources = std::mem::take(&mut state.resource_candidates)
        .into_values()
        .collect::<Vec<_>>();
    ordered_resources.sort_by(|left, right| left.url.cmp(&right.url));
    let resource_limit_reached = ordered_resources.len() > max_resource_requests;
    let selected_resources = ordered_resources
        .into_iter()
        .take(max_resource_requests)
        .collect::<Vec<_>>();
    let mut resources = Vec::new();

    if robots_crawl_delay.is_some() {
        for candidate in selected_resources {
            if !can_fetch_resources(setup, control, state).await {
                break;
            }
            if let (Some(delay), Some(last_request_at)) =
                (robots_crawl_delay, state.last_page_request_at)
            {
                if !wait_for_crawl_delay(control, &setup.run_id, last_request_at, delay).await {
                    break;
                }
                if !can_fetch_resources(setup, control, state).await {
                    break;
                }
            }
            state.last_page_request_at = Some(Instant::now());
            resources.push(
                fetch_resource_candidate_with_context(
                    setup.client.clone(),
                    candidate,
                    setup.retry_context(),
                )
                .await,
            );
        }
    } else {
        if !selected_resources.is_empty() && !can_fetch_resources(setup, control, state).await {
            return (resources, resource_limit_reached);
        }
        let max_concurrent_requests = setup
            .config
            .max_concurrent_requests
            .unwrap_or(4)
            .clamp(1, 16);
        let mut pending = selected_resources.into_iter();
        let mut tasks = JoinSet::new();
        for _ in 0..max_concurrent_requests {
            if let Some(candidate) = pending.next() {
                tasks.spawn(fetch_resource_candidate_with_context(
                    setup.client.clone(),
                    candidate,
                    setup.retry_context(),
                ));
            }
        }
        while let Some(joined) = tasks.join_next().await {
            if !can_fetch_resources(setup, control, state).await {
                tasks.abort_all();
                break;
            }
            match joined {
                Ok(resource) => resources.push(resource),
                Err(_) => resources.push(CrawledResource {
                    source_urls: Vec::new(),
                    url: String::new(),
                    resource_type: "other".into(),
                    http_status: None,
                    content_type: None,
                    content_length: None,
                    intrinsic_width: None,
                    intrinsic_height: None,
                    dimensions_source: None,
                    response_time_ms: None,
                    request_error_kind: Some("resource_task".into()),
                }),
            }
            if let Some(candidate) = pending.next() {
                tasks.spawn(fetch_resource_candidate_with_context(
                    setup.client.clone(),
                    candidate,
                    setup.retry_context(),
                ));
            }
        }
    }
    resources.retain(|resource| !resource.url.is_empty());
    resources.sort_by(|left, right| left.url.cmp(&right.url));

    (resources, resource_limit_reached)
}
