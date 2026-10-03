use std::time::{Duration, Instant};
use tauri::AppHandle;

use super::super::{
    control::{wait_for_crawl_cancellation, CrawlControl},
    crawl_delay::wait_for_crawl_delay,
    fetch_types::{CrawlFetchFailure, FetchedPageBody, FetchedResponse},
    request_error::request_error_kind,
    transport::request_with_safe_redirects,
};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;
use crate::commands::rendered_crawler::{RenderOptions, RenderedCrawlerSession};

pub async fn fetch_page_step(
    app: &AppHandle,
    control: &CrawlControl,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
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
    let resp: Result<FetchedResponse, CrawlFetchFailure> = if let Some(response) =
        prefetched_response
    {
        response
    } else if setup.config.crawl_mode == "browser-rendered" {
        if state.rendered_session.is_none() && state.rendered_init_error.is_none() {
            let options = RenderOptions {
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
            };
            match RenderedCrawlerSession::open(
                app,
                current_url,
                &setup.base_host,
                setup.config.allow_subdomains,
                setup.config.scope_path.as_deref(),
                options,
            )
            .await
            {
                Ok(session) => state.rendered_session = Some(session),
                Err(message) => state.rendered_init_error = Some(message),
            }
        }
        if let Some(message) = &state.rendered_init_error {
            Err(CrawlFetchFailure {
                kind: "browser_render".into(),
                message: message.clone(),
            })
        } else {
            let render_timeout = setup
                .max_run_seconds
                .map(|seconds| {
                    Duration::from_secs(seconds).saturating_sub(setup.start_time.elapsed())
                })
                .unwrap_or(Duration::from_secs(60))
                .min(Duration::from_secs(60));
            let capture = state
                .rendered_session
                .as_mut()
                .expect("rendered session initialized")
                .capture(current_url);
            tokio::select! {
                result = capture => result
                    .map(|snapshot| {
                        let final_url = snapshot.final_url.clone();
                        FetchedResponse {
                            response: FetchedPageBody::Rendered(snapshot),
                            final_url,
                            redirect_chain: Vec::new(),
                            redirect_stopped_reason: None,
                        }
                    })
                    .map_err(|message| CrawlFetchFailure { kind: "browser_render".into(), message }),
                _ = wait_for_crawl_cancellation(control, &setup.run_id) => Err(CrawlFetchFailure {
                    kind: "cancelled".into(),
                    message: "Crawl was cancelled during page rendering.".into(),
                }),
                _ = tokio::time::sleep(render_timeout) => {
                    state.timed_out = true;
                    Err(CrawlFetchFailure {
                        kind: "timeout".into(),
                        message: "Rendered page exceeded the remaining crawl time.".into(),
                    })
                }
            }
        }
    } else {
        request_with_safe_redirects(
            &setup.client,
            current_url,
            &setup.base_host,
            setup.config.allow_subdomains,
            setup.config.scope_path.as_deref(),
            &setup.config.allowed_hosts,
            setup.max_redirects,
            &setup.config,
        )
        .await
        .map_err(|error| CrawlFetchFailure {
            kind: request_error_kind(&error),
            message: error.to_string(),
        })
    };
    let page_duration = page_start.elapsed().as_millis() as u64;
    (resp, page_duration)
}
