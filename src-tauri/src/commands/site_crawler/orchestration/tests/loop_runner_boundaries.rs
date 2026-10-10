use super::super::{loop_runner::run_crawl_loop, selectors::CrawlSelectors};
use super::discovery_http_fixture::{html_route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::site_crawler::models::CrawledPageSummary;
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

fn dummy_page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0, "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable", "body_truncated": false, "word_count": 0, "schema_types": [], "schema_syntax_errors": 0, "hreflangs": [], "h1_count": 0, "heading_counts": [0, 0, 0, 0, 0, 0], "internal_link_count": 0, "external_link_count": 0, "links": [], "images": [], "issues_count": 0, "issues": []
    })).unwrap()
}

#[tokio::test]
async fn loop_runner_stops_when_pages_reaches_limit_boundary() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/", "<html><body>root</body></html>")],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.pages.push(dummy_page("https://example.test/prev"));
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
    assert_eq!(state.queue.len(), 1);
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn loop_runner_pops_from_prefetched_order_before_queue() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![
            html_route("/first", "<html><body>first</body></html>"),
            html_route("/second", "<html><body>second</body></html>"),
        ],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.prefetched_order.push_back((server.url("/first"), 0));
    state.queue.push_back((server.url("/second"), 0));

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
    assert_eq!(state.pages[0].url, server.url("/first"));
    assert_eq!(state.queue.len(), 1);
    assert_eq!(state.queue[0].0, server.url("/second"));
}

#[tokio::test]
async fn loop_runner_stops_when_cancelled_before_page_fetch() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(2)),
        vec![html_route("/", "<html><body>root</body></html>")],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let mut state = empty_state();
    state.queue.push_back((server.url("/"), 0));

    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(server.setup.run_id.clone());

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
    assert!(server.requests.lock().unwrap().is_empty());
}
