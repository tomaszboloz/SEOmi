use super::super::{loop_runner::run_crawl_loop, selectors::CrawlSelectors};
use super::discovery_http_fixture::{html_route, DiscoveryServer};
use super::loop_runner_coverage::empty_state;
use super::setup_config::default_crawl_config;
use super::*;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn cancellation_preserves_pending_urls() {
    let mut server = DiscoveryServer::new(
        default_crawl_config(Some(5)),
        vec![html_route("/valid", "<html><body><p>OK</p></body></html>")],
    )
    .await;
    server
        .setup
        .resume_completed_urls
        .insert(server.url("/skipped"));
    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((server.url("/skipped"), 0));
    state.queue.push_back(("invalid:url".into(), 0));
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(server.setup.run_id.clone());
    state.queue.push_back((server.url("/valid"), 0));
    run_crawl_loop(
        &app.handle(),
        &control,
        &server.setup,
        &mut state,
        &CrawlSelectors::compile(),
        &[],
        None,
    )
    .await;
    assert!(state.pages.is_empty());
    assert_eq!(state.queue.len(), 3);
    assert!(!state.timed_out);
}

#[tokio::test]
async fn resumed_completed_and_malformed_urls_are_skipped() {
    let mut server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/valid", "<html><body><p>OK</p></body></html>")],
    )
    .await;
    server
        .setup
        .resume_completed_urls
        .insert(server.url("/skipped"));
    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((server.url("/skipped"), 0));
    state.queue.push_back((":malformed".into(), 0));
    state.queue.push_back((server.url("/valid"), 0));
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
    assert_eq!(state.pages.len(), 1);
    assert_eq!(state.pages[0].url, server.url("/valid"));
    assert!(state.queue.is_empty());
    assert!(state.rejected_urls.is_empty());
}
