use super::discovery_http_fixture::{route, DiscoveryServer};
use super::*;

#[tokio::test]
async fn disabled_discovery_and_expired_deadline_make_no_request() {
    let mut config = default_crawl_config(None);
    config.discover_sitemaps = false;
    let mut server = DiscoveryServer::new(config, vec![]).await;
    let result = discover_and_parse_sitemaps(&server.setup, &[])
        .await
        .unwrap();
    assert!(result.sitemap_status.contains("disabled"));
    assert!(result.sitemap_urls.is_empty());
    assert!(!result.timed_out);
    server.setup.config.discover_sitemaps = true;
    server.setup.max_run_seconds = Some(1);
    server.setup.start_time = std::time::Instant::now() - std::time::Duration::from_secs(2);
    let result = discover_and_parse_sitemaps(&server.setup, &[])
        .await
        .unwrap();
    assert!(result.timed_out);
    assert!(result.sitemap_status.contains("Loaded 0"));
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn candidate_scope_duplicates_invalid_urls_and_body_limit_are_reported() {
    let mut server = DiscoveryServer::new(default_crawl_config(None), vec![
        route("/large.xml", 200, &"x".repeat(1025)),
        route("/missing.xml", 404, "ignored"),
        route("/good.xml", 200, "<urlset><loc>{BASE}z</loc><loc>{BASE}a?utm_source=fixture</loc><loc>http://localhost/private</loc><loc>https://other.test/page</loc></urlset>"),
    ]).await;
    server.setup.max_response_bytes = 1024;
    let candidates = vec![
        server.url("/large.xml"),
        server.url("/missing.xml"),
        server.url("/good.xml"),
        server.url("/good.xml"),
        "http://localhost/secret".into(),
        "https://other.test/map.xml".into(),
    ];
    let result = discover_and_parse_sitemaps(&server.setup, &candidates)
        .await
        .unwrap();
    assert_eq!(
        result.sitemap_urls,
        vec![server.url("/a"), server.url("/z")]
    );
    assert!(result.sitemap_status.contains("Loaded 1"));
    assert!(result
        .sitemap_status
        .contains("1 source body read(s) failed"));
    assert_eq!(
        *server.requests.lock().unwrap(),
        vec!["/large.xml", "/missing.xml", "/good.xml"]
    );
    assert!(!result.timed_out);
}

#[tokio::test]
async fn sitemap_cycles_stop_and_source_budget_is_twenty() {
    let children: String = (0..25)
        .map(|n| format!("<loc>{{BASE}}child{n}.xml</loc>"))
        .collect();
    let mut routes = vec![route(
        "/sitemap.xml",
        200,
        &format!("<sitemapindex><loc>{{BASE}}sitemap.xml</loc>{children}</sitemapindex>"),
    )];
    routes.extend((0..25).map(|n| {
        route(
            &format!("/child{n}.xml"),
            200,
            "<urlset><loc>{BASE}page</loc></urlset>",
        )
    }));
    let server = DiscoveryServer::new(default_crawl_config(None), routes).await;
    let result = discover_and_parse_sitemaps(&server.setup, &[])
        .await
        .unwrap();
    assert_eq!(server.requests.lock().unwrap().len(), 20);
    assert_eq!(result.sitemap_urls, vec![server.url("/page")]);
    assert!(result.sitemap_status.contains("Loaded 20"));
    assert!(!result.timed_out);
}
