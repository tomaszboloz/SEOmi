use super::super::{loop_runner::run_crawl_loop, selectors::CrawlSelectors};
use super::discovery_http_fixture::{html_route, DiscoveryServer};
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
async fn loop_runner_enforces_depth_limit_boundary_on_discovered_links() {
    let mut server = DiscoveryServer::new(
        default_crawl_config(Some(5)),
        vec![
            html_route("/", "<html><body><a href=\"/depth1\">d1</a></body></html>"),
            html_route(
                "/depth1",
                "<html><body><a href=\"/depth2\">d2</a></body></html>",
            ),
        ],
    )
    .await;
    server.setup.max_depth = 0;

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
    assert!(state.depth_limit_reached);
    assert!(state.queue.is_empty());
}
