use super::discovery_http_fixture::{refused_setup, route, DiscoveryServer};
use super::*;

#[tokio::test]
async fn unique_limit_retains_existing_url_provenance_from_later_sources() {
    let pages: String = (0..10_001)
        .map(|n| format!("<loc>{{BASE}}page{n}</loc>"))
        .collect();
    let server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![
            route("/first.xml", 200, &format!("<urlset>{pages}</urlset>")),
            route(
                "/second.xml",
                200,
                "<urlset><loc>{BASE}page0</loc></urlset>",
            ),
        ],
    )
    .await;
    let result = discover_and_parse_sitemaps(
        &server.setup,
        &[server.url("/first.xml"), server.url("/second.xml")],
    )
    .await
    .unwrap();
    assert_eq!(result.sitemap_urls.len(), 10_000);
    assert!(result.sitemap_urls.contains(&server.url("/page9999")));
    assert!(!result.sitemap_urls.contains(&server.url("/page10000")));
    assert_eq!(result.discovery_sources_by_url.len(), 10_000);
    let sources = &result.discovery_sources_by_url[&server.url("/page0")];
    assert_eq!(sources.len(), 2);
    assert_eq!(
        sources[0].source_url.as_deref(),
        Some(server.url("/first.xml").as_str())
    );
    assert_eq!(
        sources[1].source_url.as_deref(),
        Some(server.url("/second.xml").as_str())
    );
    assert!(result.discovery_provenance_truncated);
    assert!(result.sitemap_status.contains("Loaded 2"));
}

#[tokio::test]
async fn provenance_source_cap_is_reported_without_duplicate_pages() {
    let routes = (0..20)
        .map(|n| {
            route(
                &format!("/map{n}.xml"),
                200,
                "<urlset><loc>{BASE}page</loc></urlset>",
            )
        })
        .collect();
    let server = DiscoveryServer::new(default_crawl_config(None), routes).await;
    let candidates = (0..20)
        .map(|n| server.url(&format!("/map{n}.xml")))
        .collect::<Vec<_>>();
    let result = discover_and_parse_sitemaps(&server.setup, &candidates)
        .await
        .unwrap();
    assert_eq!(result.sitemap_urls, vec![server.url("/page")]);
    assert_eq!(
        result.discovery_sources_by_url[&server.url("/page")].len(),
        16
    );
    assert!(result.discovery_provenance_truncated);
}

#[tokio::test]
async fn unavailable_source_does_not_invent_pages_or_body_failure() {
    let (setup, _reserved_socket) = refused_setup();
    let result = discover_and_parse_sitemaps(&setup, &[]).await.unwrap();
    assert!(result.sitemap_urls.is_empty());
    assert!(result.discovery_sources_by_url.is_empty());
    assert!(result.sitemap_status.contains("Loaded 0"));
    assert!(result
        .sitemap_status
        .contains("0 source body read(s) failed"));
    assert!(!result.timed_out);
    assert!(!result.discovery_provenance_truncated);
}
