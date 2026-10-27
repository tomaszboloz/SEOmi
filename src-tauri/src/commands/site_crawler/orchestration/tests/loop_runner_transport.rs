use super::super::{loop_runner::run_crawl_loop, selectors::CrawlSelectors};
use super::discovery_http_fixture::{html_route, route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::utils::test_app::StorageApp;
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
async fn loop_fetches_html_and_prefetches_frontier_children() {
    let mut config = default_crawl_config(Some(3));
    config.max_concurrent_requests = Some(2);
    let server = DiscoveryServer::new(
        config,
        vec![
            html_route(
                "/",
                "<html><body><a href='/one'>one</a><a href='/two'>two</a></body></html>",
            ),
            html_route("/one", "<html><body><p>one</p></body></html>"),
            html_route("/two", "<html><body><p>two</p></body></html>"),
        ],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let mut state = empty_state();
    state.queue.push_back((server.url("/"), 0));
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

    assert!(!state.pages.is_empty());
    assert!(state.pages.iter().any(|page| page.url == server.url("/")));
    let requests = server.requests.lock().unwrap();
    assert!(requests.iter().any(|path| path == "/one"));
    assert!(requests.iter().any(|path| path == "/two"));
}

#[tokio::test]
async fn loop_turns_http_failures_into_measured_pages() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![route("/", 503, "temporarily unavailable")],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((server.url("/"), 0));
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
    assert_eq!(state.pages[0].url, server.url("/"));
    assert_eq!(state.pages[0].http_status, 503);
    assert!(state.pages[0].request_error_kind.is_none());
}
