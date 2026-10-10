use super::super::pipeline::run_crawl_pipeline;
use super::discovery_http_fixture::{html_route, route, DiscoveryServer};
use super::*;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn pipeline_normalizes_duplicate_links_and_enforces_scope_filters_nofollow_and_robots() {
    let mut config = default_crawl_config(Some(10));
    config.discover_sitemaps = false;
    config.scope_path = Some("/docs".into());
    config.lowercase_path = true;
    config.trim_trailing_slash = true;
    config.keep_query_strings = true;
    config.strip_tracking_parameters = true;
    config.max_concurrent_requests = Some(1);
    config.exclude_patterns = vec!["private$".into()];
    let mut server = DiscoveryServer::new(
        config,
        vec![
            route(
                "/robots.txt",
                200,
                "User-agent: *\nDisallow: /docs/blocked\n",
            ),
            html_route(
                "/docs",
                "<html><body><a href='/docs/Guide/?utm_source=x#one'>First</a>\
                 <a href='/docs/guide#two'>Second</a><a href='/outside'>Outside</a>\
                 <a href='/docs/private'>Private</a>\
                 <a href='/docs/nofollow' rel='nofollow'>Nofollow</a>\
                 <a href='/docs/blocked'>Blocked</a></body></html>",
            ),
            html_route("/docs/guide", "<html><body><h1>Guide</h1></body></html>"),
        ],
    )
    .await;
    server.setup.normalized_start_url = url::Url::parse(&server.url("/docs")).unwrap();
    let app = StorageApp::new(mock_builder());
    let result = run_crawl_pipeline(&app.handle(), &CrawlControl::new(), &server.setup)
        .await
        .unwrap();
    assert_eq!(result.pages_crawled, 2);
    let root = result
        .pages
        .iter()
        .find(|page| page.url == server.url("/docs"))
        .unwrap();
    assert_eq!(root.internal_link_count, 5);
    assert_eq!(root.external_link_count, 1);
    assert_eq!(root.links[0].target_url, server.url("/docs/guide"));
    assert_eq!(root.links[1].target_url, root.links[0].target_url);
    assert!(!root.links[2].is_internal);
    let guide = result
        .pages
        .iter()
        .find(|page| page.url == server.url("/docs/guide"))
        .unwrap();
    assert_eq!(guide.depth, 1);
    assert_eq!(guide.discovery_sources.len(), 2);
    assert_eq!(
        guide.discovery_sources[0].anchor_text.as_deref(),
        Some("First")
    );
    assert_eq!(
        guide.discovery_sources[1].anchor_text.as_deref(),
        Some("Second")
    );
    assert_eq!(result.robots_blocked_count, 1);
    assert_eq!(result.rejected_urls.len(), 1);
    assert_eq!(result.rejected_urls[0].url, server.url("/docs/blocked"));
    assert!(result.rejected_urls[0]
        .reason
        .contains("Disallow rule: /docs/blocked"));
    assert_eq!(
        *server.requests.lock().unwrap(),
        vec!["/robots.txt", "/docs", "/docs/guide"],
    );
}

#[tokio::test]
async fn pipeline_reports_depth_limit_without_requesting_discovered_child() {
    let mut config = default_crawl_config(Some(10));
    config.discover_sitemaps = false;
    config.respect_robots = false;
    config.max_depth = Some(0);
    config.max_concurrent_requests = Some(1);
    let server = DiscoveryServer::new(
        config,
        vec![html_route(
            "/",
            "<html><body><a href='/child'>Child</a></body></html>",
        )],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let result = run_crawl_pipeline(&app.handle(), &CrawlControl::new(), &server.setup)
        .await
        .unwrap();
    assert_eq!(result.pages_crawled, 1);
    assert_eq!(result.pages[0].links[0].target_url, server.url("/child"));
    assert_eq!(result.limit_reasons, vec!["max_depth"]);
    assert!(!result.cancelled && !result.timed_out);
    assert_eq!(*server.requests.lock().unwrap(), vec!["/"]);
}
