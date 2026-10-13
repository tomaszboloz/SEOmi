use super::discovery_http_fixture::{route, DiscoveryServer};
use super::*;

#[tokio::test]
async fn index_children_outside_page_scope_still_discover_scoped_pages() {
    let mut config = default_crawl_config(None);
    config.scope_path = Some("/shop".into());
    let server = DiscoveryServer::new(config, vec![
        route("/sitemap.xml", 200, "<sitemapindex><sitemap><loc>{BASE}maps/products.xml</loc></sitemap></sitemapindex>"),
        route("/maps/products.xml", 200, "<urlset><url><loc>{BASE}shop/item</loc></url><url><loc>{BASE}blog/post</loc></url></urlset>"),
    ]).await;
    let result = discover_and_parse_sitemaps(&server.setup, &[])
        .await
        .unwrap();
    assert_eq!(result.sitemap_urls, vec![server.url("/shop/item")]);
    assert_eq!(
        *server.requests.lock().unwrap(),
        vec!["/sitemap.xml", "/maps/products.xml"]
    );
    let sources = &result.discovery_sources_by_url[&server.url("/shop/item")];
    assert_eq!(sources.len(), 1);
    assert_eq!(sources[0].kind, "sitemap");
    assert_eq!(
        sources[0].source_url.as_deref(),
        Some(server.url("/maps/products.xml").as_str())
    );
    assert!(!result.discovery_provenance_truncated);
    assert!(!result.timed_out);
}

#[tokio::test]
async fn repeated_locations_do_not_consume_unique_url_capacity() {
    let repeated = "<url><loc>{BASE}shop/repeated</loc></url>".repeat(10_000);
    let body = format!("<urlset>{repeated}<url><loc>{{BASE}}shop/new</loc></url></urlset>");
    let server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![route("/sitemap.xml", 200, &body)],
    )
    .await;
    let result = discover_and_parse_sitemaps(&server.setup, &[])
        .await
        .unwrap();
    assert_eq!(
        result.sitemap_urls,
        vec![server.url("/shop/new"), server.url("/shop/repeated")]
    );
    assert_eq!(result.discovery_sources_by_url.len(), 2);
    assert_eq!(
        result.discovery_sources_by_url[&server.url("/shop/repeated")].len(),
        1
    );
    assert!(!result.discovery_provenance_truncated);
}

#[tokio::test]
async fn default_sitemap_url_construction_failure_is_reported() {
    let mut server = DiscoveryServer::new(default_crawl_config(None), vec![]).await;
    server.setup.parsed_base = url::Url::parse("mailto:owner@example.com").unwrap();
    let error = match discover_and_parse_sitemaps(&server.setup, &[]).await {
        Err(error) => error,
        Ok(_) => panic!("a non-hierarchical base cannot host /sitemap.xml"),
    };
    assert!(error.starts_with("Failed to construct sitemap URL: "));
}
