use super::super::page_fetch::fetch_page_step;
use super::discovery_http_fixture::{route, DiscoveryServer};
use super::page_fixture::data;
use super::*;
use crate::commands::site_crawler::fetch_types::{FetchedPageBody, FetchedResponse};
use crate::commands::site_crawler::robots::RobotsRule;
use crate::utils::test_app::StorageApp;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::test::{mock_builder, MockRuntime};

fn mock_state() -> CrawlLoopState<MockRuntime> {
    CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    )
}

#[tokio::test]
async fn prefetched_response_is_consumed_without_a_second_request() {
    let server = DiscoveryServer::new(default_crawl_config(None), vec![]).await;
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let mut state = mock_state();
    let url = server.url("/prefetched");
    state.prefetched_responses.insert(
        url.clone(),
        Ok(FetchedResponse {
            response: FetchedPageBody::Prefetched(Box::new(data("<html>cached</html>"))),
            final_url: url.clone(),
            redirect_chain: Vec::new(),
            redirect_stopped_reason: None,
            request_duration_ms: None,
            retry_count: 0,
        }),
    );

    let (fetched, _) = fetch_page_step(
        &app.handle(),
        &control,
        &server.setup,
        &mut state,
        None,
        &url,
    )
    .await;
    let fetched = match fetched {
        Ok(fetched) => fetched,
        Err(_) => panic!("prefetched response should be returned"),
    };
    assert!(matches!(fetched.response, FetchedPageBody::Prefetched(_)));
    assert!(state.prefetched_responses.is_empty());
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn cancellation_during_page_crawl_delay_prevents_transport() {
    let server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![route("/page", 200, "page")],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let control = Arc::new(CrawlControl::new());
    let run_id = server.setup.run_id.clone();
    let canceller = Arc::clone(&control);
    let cancel = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(25)).await;
        canceller.cancelled_runs.lock().unwrap().insert(run_id);
    });
    let initial_request = Instant::now();
    let mut state = mock_state();
    state.last_page_request_at = Some(initial_request);
    let result = fetch_page_step(
        &app.handle(),
        &control,
        &server.setup,
        &mut state,
        Some(Duration::from_secs(5)),
        &server.url("/page"),
    )
    .await;
    cancel.await.unwrap();

    let (failure, _) = result;
    match failure {
        Err(failure) => assert_eq!(failure.kind, "cancelled"),
        Ok(_) => panic!("cancelled page fetch unexpectedly succeeded"),
    }
    assert_eq!(state.last_page_request_at, Some(initial_request));
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn generic_loop_records_robots_rejection_with_mock_runtime() {
    let server = DiscoveryServer::new(default_crawl_config(None), vec![]).await;
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let blocked_url = server.url("/private");
    let mut state = mock_state();
    state.queue.push_back((blocked_url.clone(), 0));
    run_crawl_loop(
        &app.handle(),
        &control,
        &server.setup,
        &mut state,
        &CrawlSelectors::compile(),
        &[RobotsRule {
            allow: false,
            path: "/private".into(),
        }],
        None,
    )
    .await;

    assert_eq!(state.robots_blocked_count, 1);
    assert!(state.pages.is_empty());
    assert_eq!(state.rejected_urls[0].url, blocked_url);
    assert!(state.rejected_urls[0].reason.contains("robots.txt"));
    assert!(server.requests.lock().unwrap().is_empty());
}
