use super::super::{loop_runner::run_crawl_loop, robots::parse_robots_rules, selectors::CrawlSelectors};
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
async fn loop_runner_respects_robots_disallow_rules_and_tracks_rejected_urls() {
    let mut config = default_crawl_config(Some(5));
    config.respect_robots = true;
    let server = DiscoveryServer::new(
        config,
        vec![
            html_route("/", "<html><body><p>Root</p></body></html>"),
            html_route("/disallowed", "<html><body><p>Disallowed</p></body></html>"),
        ],
    )
    .await;
    let robots_content = "User-agent: *\nDisallow: /disallowed\n";
    let rules = parse_robots_rules(robots_content, "SEOmi-Crawler");

    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((server.url("/"), 0));
    state.queue.push_back((server.url("/disallowed"), 0));

    run_crawl_loop(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        &CrawlSelectors::compile(),
        &rules,
        None,
    )
    .await;

    assert_eq!(state.robots_blocked_count, 1);
    assert_eq!(state.rejected_urls.len(), 1);
    assert_eq!(state.rejected_urls[0].url, server.url("/disallowed"));
    assert!(state.rejected_urls[0].reason.contains("Blocked by robots.txt Disallow rule"));
    assert_eq!(state.pages.len(), 1);
    assert_eq!(state.pages[0].url, server.url("/"));
}

#[tokio::test]
async fn loop_runner_stops_when_limit_is_reached() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![
            html_route("/page1", "<html><body><p>One</p></body></html>"),
            html_route("/page2", "<html><body><p>Two</p></body></html>"),
        ],
    )
    .await;

    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((server.url("/page1"), 0));
    state.queue.push_back((server.url("/page2"), 0));

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
    assert_eq!(state.pages[0].url, server.url("/page1"));
    assert_eq!(state.queue.len(), 1);
    assert_eq!(state.queue[0].0, server.url("/page2"));
}

#[tokio::test]
async fn loop_runner_prioritizes_prefetched_order_over_queue() {
    let server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![
            html_route("/from_queue", "<html><body><p>Queue</p></body></html>"),
            html_route("/from_prefetch", "<html><body><p>Prefetch</p></body></html>"),
        ],
    )
    .await;

    let app = StorageApp::new(mock_builder());
    let mut state = empty_state();
    state.queue.push_back((server.url("/from_queue"), 0));
    state.prefetched_order.push_back((server.url("/from_prefetch"), 0));

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
    assert_eq!(state.pages[0].url, server.url("/from_prefetch"));
}
