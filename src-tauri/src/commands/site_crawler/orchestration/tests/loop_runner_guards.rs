use super::super::{loop_runner::run_crawl_loop, selectors::CrawlSelectors};
use super::discovery_http_fixture::{html_route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::utils::test_app::StorageApp;
use std::time::{Duration, Instant};
use tauri::test::{mock_builder, MockRuntime};

fn empty_state() -> CrawlLoopState<MockRuntime> {
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
async fn loop_skips_resumed_invalid_and_expired_frontier_entries() {
    let mut server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/", "<html><body>root</body></html>")],
    )
    .await;
    let root = server.url("/");
    server.setup.resume_completed_urls.insert(root.clone());
    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((root, 0));
    state.queue.push_back(("not a URL".into(), 0));
    run_crawl_loop(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        &CrawlSelectors::compile(),
        &[],
        None,
    )
    .await;
    assert!(state.pages.is_empty());
    assert!(state.queue.is_empty());

    let mut expired = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/", "<html><body>expired</body></html>")],
    )
    .await;
    let expired_root = expired.url("/");
    expired.setup.max_run_seconds = Some(1);
    expired.setup.start_time = Instant::now() - Duration::from_secs(2);
    let mut expired_state = empty_state();
    expired_state.queue.push_back((expired_root, 0));
    run_crawl_loop(
        &app.handle(),
        &CrawlControl::new(),
        &expired.setup,
        &mut expired_state,
        &CrawlSelectors::compile(),
        &[],
        None,
    )
    .await;
    assert!(expired_state.timed_out);
    assert!(expired_state.pages.is_empty());
    assert_eq!(expired_state.queue.len(), 1);
}

#[tokio::test]
async fn loop_waits_for_resume_and_stops_cancelled_runs() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/", "<html><body>paused</body></html>")],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    control.pause(&server.setup.run_id);
    let mut state = empty_state();
    state.queue.push_back((server.url("/"), 0));
    let handle = app.handle();
    let selectors = CrawlSelectors::compile();
    {
        let future = run_crawl_loop(
            &handle,
            &control,
            &server.setup,
            &mut state,
            &selectors,
            &[],
            None,
        );
        tokio::pin!(future);
        assert!(tokio::time::timeout(Duration::from_millis(30), &mut future)
            .await
            .is_err());
        assert!(server.requests.lock().unwrap().is_empty());
        control.resume(&server.setup.run_id);
        future.as_mut().await;
    }
    assert_eq!(state.pages.len(), 1);

    let cancelled = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/", "<html><body>cancelled</body></html>")],
    )
    .await;
    let cancelled_control = CrawlControl::new();
    cancelled_control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(cancelled.setup.run_id.clone());
    let mut cancelled_state = empty_state();
    cancelled_state.queue.push_back((cancelled.url("/"), 0));
    run_crawl_loop(
        &app.handle(),
        &cancelled_control,
        &cancelled.setup,
        &mut cancelled_state,
        &CrawlSelectors::compile(),
        &[],
        None,
    )
    .await;
    assert!(cancelled_state.pages.is_empty());
    assert_eq!(cancelled_state.queue.len(), 1);
    assert!(cancelled.requests.lock().unwrap().is_empty());
}
