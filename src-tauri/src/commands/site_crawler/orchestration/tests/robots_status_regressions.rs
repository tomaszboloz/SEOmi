use super::discovery_http_fixture::{redirect, route, DiscoveryServer};
use super::*;

#[test]
fn robots_scope_does_not_create_www_alias_for_literal_ip_hosts() {
    let mut setup = setup(default_crawl_config(None));
    setup.parsed_base = url::Url::parse("https://192.0.2.10/").unwrap();
    let hosts = super::super::robots_scope::robots_allowed_hosts(&setup);
    assert!(hosts.iter().all(|host| !host.starts_with("www.")));
}

#[tokio::test]
async fn canonical_www_redirect_is_followed_and_rules_survive() {
    let body =
        "User-agent: *\nDisallow: /private\nCrawl-delay: 1.25\nSitemap: {BASE}canonical.xml\n";
    let mut server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![
            redirect(
                "/robots.txt",
                "http://www.example.test:{PORT}/robots-canonical.txt",
            ),
            route("/robots-canonical.txt", 200, body),
        ],
    )
    .await;
    server.setup.max_redirects = 0;
    let result = fetch_and_eval_robots(&server.setup).await.unwrap();
    assert_eq!(result.robots_txt_evaluation_status, "loaded");
    assert_eq!(result.robots_rules.len(), 1);
    assert_eq!(
        result.robots_crawl_delay,
        Some(std::time::Duration::from_millis(1250))
    );
    assert_eq!(result.robots_sitemaps, vec![server.url("/canonical.xml")]);
    assert_eq!(result.robots_txt_redirect_chain.len(), 1);
    assert_eq!(result.robots_txt_redirect_chain[0].http_status, 302);
    assert_eq!(
        *server.requests.lock().unwrap(),
        vec!["/robots.txt", "/robots-canonical.txt"]
    );
}

#[tokio::test]
async fn robots_redirects_reject_ssrf_and_unconfigured_hosts() {
    for location in [
        "http://127.0.0.1:{PORT}/private",
        "https://evil.example/robots.txt",
    ] {
        let server = DiscoveryServer::new(
            default_crawl_config(None),
            vec![redirect("/robots.txt", location)],
        )
        .await;
        let result = fetch_and_eval_robots(&server.setup).await.unwrap();
        assert_eq!(result.robots_txt_evaluation_status, "unknown");
        assert!(result.robots_txt_warning.is_some());
        assert_eq!(*server.requests.lock().unwrap(), vec!["/robots.txt"]);
    }
}

#[tokio::test]
async fn robots_redirects_have_at_least_five_validated_hops() {
    let mut routes = vec![redirect("/robots.txt", "/r1")];
    for index in 1..=6 {
        routes.push(redirect(&format!("/r{index}"), &format!("/r{}", index + 1)));
    }
    let mut server = DiscoveryServer::new(default_crawl_config(None), routes).await;
    server.setup.max_redirects = 0;
    let result = fetch_and_eval_robots(&server.setup).await.unwrap();
    assert_eq!(result.robots_txt_evaluation_status, "unknown");
    assert!(result.robots_txt_status.contains("Redirect limit"));
    assert_eq!(result.robots_txt_redirect_chain.len(), 6);
    assert_eq!(server.requests.lock().unwrap().len(), 6);
}

#[tokio::test]
async fn four_xx_is_unrestricted_but_429_and_five_xx_are_unknown() {
    for status in [400, 401, 403, 404, 410] {
        let server = DiscoveryServer::new(
            default_crawl_config(None),
            vec![route("/robots.txt", status, "ignored")],
        )
        .await;
        let result = fetch_and_eval_robots(&server.setup).await.unwrap();
        assert_eq!(result.robots_txt_evaluation_status, "unrestricted");
        assert_eq!(result.robots_txt_status_code, Some(status));
        assert!(result.robots_txt_warning.is_none());
    }
    for status in [429, 500, 502, 503, 504] {
        let server = DiscoveryServer::new(
            default_crawl_config(None),
            vec![route("/robots.txt", status, "temporary")],
        )
        .await;
        let result = fetch_and_eval_robots(&server.setup).await.unwrap();
        assert_eq!(result.robots_txt_evaluation_status, "unknown");
        assert_eq!(result.robots_txt_status_code, Some(status));
        assert!(result.robots_txt_warning.is_some());
        let expected_requests = if [429, 502, 503, 504].contains(&status) {
            2
        } else {
            1
        };
        assert_eq!(server.requests.lock().unwrap().len(), expected_requests);
    }
}
