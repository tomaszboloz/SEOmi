use super::super::pipeline::run_crawl_pipeline;
use super::discovery_http_fixture::{html_route, redirect, route, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn pipeline_keeps_html_redirect_and_fetch_failure_evidence() {
    let mut config = default_crawl_config(Some(4));
    config.max_concurrent_requests = Some(1);
    config.max_resource_requests = Some(0);
    let server = DiscoveryServer::new(
        config,
        vec![
            route("/robots.txt", 200, "User-agent: *\nAllow: /\n"),
            html_route(
                "/",
                "<html><body><a href='/redirect'>redirect</a><a href='/missing'>missing</a></body></html>",
            ),
            redirect("/redirect", "/article"),
            html_route("/article", "<html><body><h1>Article</h1></body></html>"),
            route("/missing", 503, "unavailable"),
        ],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let result = run_crawl_pipeline(&app.handle(), &CrawlControl::new(), &server.setup)
        .await
        .unwrap();

    let redirected = result
        .pages
        .iter()
        .find(|page| page.url == server.url("/redirect"))
        .unwrap();
    assert_eq!(redirected.final_url, server.url("/article"));
    assert_eq!(redirected.redirect_chain[0].http_status, 302);
    let failed = result
        .pages
        .iter()
        .find(|page| page.url == server.url("/missing"))
        .unwrap();
    assert_eq!(failed.http_status, 503);
    assert!(failed.request_error_kind.is_none());
    assert!(result.pages_crawled >= 3);
    assert!(result.robots_txt_status.contains("Loaded"));
    assert!(server
        .requests
        .lock()
        .unwrap()
        .contains(&"/redirect".into()));
}
