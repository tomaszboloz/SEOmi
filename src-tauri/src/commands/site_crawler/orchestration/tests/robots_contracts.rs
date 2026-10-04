use super::discovery_http_fixture::{route, DiscoveryServer};
use super::*;

#[tokio::test]
async fn unavailable_robots_allow_urls_without_inventing_rules() {
    let (setup, _reserved_socket) = super::discovery_http_fixture::refused_setup();
    let result = fetch_and_eval_robots(&setup).await.unwrap();
    assert!(result.robots_txt_status.contains("unavailable"));
    assert!(result.robots_txt_status.contains("URLs allowed"));
    assert!(result.robots_rules.is_empty());
    assert!(result.robots_applicable_rules.is_empty());
    assert!(result.robots_agent_matrix.is_empty());
    assert!(result.robots_sitemaps.is_empty());
    assert_eq!(result.robots_crawl_delay, None);
}

#[tokio::test]
async fn robots_rules_directives_and_delay_keep_observed_evidence() {
    let body = "User-agent: *\nDisallow: /private\nAllow: /private/public\nCrawl-delay: 1.5\nSitemap: {BASE}maps/all.xml\n";
    let mut server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![route("/robots.txt", 200, body)],
    )
    .await;
    server.setup.config.respect_robots = true;
    server.setup.config.respect_crawl_delay = true;
    let result = fetch_and_eval_robots(&server.setup).await.unwrap();
    assert_eq!(result.robots_rules.len(), 2);
    assert_eq!(result.robots_applicable_rules[0].directive, "disallow");
    assert_eq!(result.robots_applicable_rules[0].path, "/private");
    assert_eq!(result.robots_applicable_rules[1].directive, "allow");
    assert_eq!(
        result.robots_crawl_delay,
        Some(std::time::Duration::from_millis(1500))
    );
    assert!(result.robots_txt_status.contains("enforced"));
    assert!(!result.robots_agent_matrix.is_empty());
    assert_eq!(result.robots_sitemaps, vec![server.url("/maps/all.xml")]);
    assert_eq!(result.robots_sitemap_directives, result.robots_sitemaps);
    for (respect_robots, respect_delay) in [(false, true), (true, false), (false, false)] {
        server.setup.config.respect_robots = respect_robots;
        server.setup.config.respect_crawl_delay = respect_delay;
        let result = fetch_and_eval_robots(&server.setup).await.unwrap();
        assert_eq!(result.robots_crawl_delay, None);
        assert!(result.robots_txt_status.contains("ignored"));
        assert_eq!(result.robots_rules.len(), 2);
        assert_eq!(result.robots_sitemaps, vec![server.url("/maps/all.xml")]);
    }
}

#[tokio::test]
async fn robots_disabled_missing_http_error_and_bounded_failure_are_truthful() {
    for (status, body, expected) in [
        (404, "", "not found"),
        (503, "", "HTTP 503"),
        (200, "no matching agents", "Loaded 0"),
        (200, "User-agent: *\nDisallow: /x", "could not be read"),
    ] {
        let mut server = DiscoveryServer::new(
            default_crawl_config(None),
            vec![route("/robots.txt", status, body)],
        )
        .await;
        if expected == "could not be read" {
            server.setup.max_response_bytes = 5;
        }
        let result = fetch_and_eval_robots(&server.setup).await.unwrap();
        assert!(
            result.robots_txt_status.contains(expected),
            "{}",
            result.robots_txt_status
        );
        assert!(result.robots_rules.is_empty());
        assert!(result.robots_applicable_rules.is_empty());
        assert!(result.robots_sitemap_directives.is_empty());
        assert_eq!(result.robots_crawl_delay, None);
    }
    let mut config = default_crawl_config(None);
    config.respect_robots = false;
    config.discover_sitemaps = false;
    let server = DiscoveryServer::new(config, vec![]).await;
    let result = fetch_and_eval_robots(&server.setup).await.unwrap();
    assert!(result.robots_txt_status.contains("disabled"));
    assert!(result.robots_agent_matrix.is_empty());
    assert!(server.requests.lock().unwrap().is_empty());
}
