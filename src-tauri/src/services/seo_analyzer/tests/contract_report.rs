use super::super::analyze_page;
use super::common::test_http_performance;
use crate::models::audit_data::{IssueCategory, IssueSeverity, PageAuditData, RedirectHop};
use crate::services::http_client::FetchResult;
use std::collections::HashMap;

fn fetch_fixture(status: u16) -> FetchResult {
    FetchResult {
        url: "http://origin.test/old".into(),
        final_url: "https://destination.test/articles/page".into(),
        status,
        response_time_ms: 135,
        headers: HashMap::from([
            ("server".into(), "nginx/1.27.4".into()),
            ("content-type".into(), "text/html; charset=utf-8".into()),
        ]),
        repeated_headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: vec![RedirectHop {
            url: "http://origin.test/old".into(),
            status_code: 301,
            location: Some("https://destination.test/articles/page".into()),
        }],
        body: r#"<!doctype html><html lang="en"><head>
            <title>A stable SEO analyzer contract fixture title</title>
            <meta name="description" content="A description used by the local contract fixture to check preservation of page metadata and social fallbacks.">
            <link rel="canonical" href="https://destination.test/articles/page">
            <meta property="og:image" content="../cover.webp">
            </head><body><h1>Contract fixture</h1>
            <img src="./photo.AVIF?width=300" alt="Photo" width="300" height="200">
            <a href="./next">Next</a><a href="http://other.test/archive">Archive</a>
            <script src="http://cdn.test/app.js?token=private#main"></script>
            </body></html>"#.into(),
        http_performance: test_http_performance(),
    }
}

#[tokio::test]
async fn contract_report_preserves_fetch_evidence_and_resolves_against_final_url() {
    let fetch = fetch_fixture(200);
    let expected_redirects = fetch.redirect_chain.clone();
    let expected_performance = fetch.http_performance.clone();
    let report = analyze_page(fetch).await.unwrap();
    assert_eq!(report.url, "http://origin.test/old");
    assert_eq!(report.final_url, "https://destination.test/articles/page");
    assert_eq!(report.http_status, 200);
    assert_eq!(report.response_time_ms, 135);
    assert_eq!(report.redirect_chain, expected_redirects);
    assert_eq!(report.http_performance, Some(expected_performance));
    assert_eq!(report.technical.server.as_deref(), Some("nginx/1.27.4"));
    assert_eq!(
        report.technical.content_type.as_deref(),
        Some("text/html; charset=utf-8")
    );
    assert_eq!(
        report.open_graph.og_image.as_deref(),
        Some("https://destination.test/cover.webp")
    );
    assert_eq!(
        report.twitter_card.twitter_image,
        report.open_graph.og_image
    );
    assert_eq!(report.open_graph.og_title, report.meta_tags.title);
    assert_eq!(
        report.twitter_card.twitter_description,
        report.meta_tags.description
    );
    assert_eq!(
        report.images[0].src,
        "https://destination.test/articles/photo.AVIF?width=300"
    );
    assert_eq!(report.images[0].format.as_deref(), Some("avif"));
    assert_eq!(
        report.links.links[0].href,
        "https://destination.test/articles/next"
    );
    assert!(report.links.links[0].is_internal);
    assert_eq!(report.links.external_links, 1);
    assert_eq!(report.indexability.canonical_target_status, Some(200));
    assert_eq!(report.indexability.status, "indexable");

    let transport = report.transport_security.as_ref().unwrap();
    assert!(transport.https);
    assert_eq!(transport.mixed_content_urls, ["http://cdn.test/app.js"]);
    for (code, category, severity) in [
        (
            "links_insecure",
            IssueCategory::Links,
            IssueSeverity::Warning,
        ),
        (
            "transport_mixed_content",
            IssueCategory::Security,
            IssueSeverity::Critical,
        ),
    ] {
        let issue = report
            .issues
            .iter()
            .find(|issue| issue.code.as_deref() == Some(code))
            .unwrap();
        assert_eq!(issue.category, category);
        assert_eq!(issue.severity, severity);
        assert_eq!(issue.params.as_ref().unwrap()["count"], "1");
    }
    let json = serde_json::to_value(&report).unwrap();
    let restored: PageAuditData = serde_json::from_value(json.clone()).unwrap();
    assert_eq!(serde_json::to_value(restored).unwrap(), json);
    assert!(!json.to_string().contains("token=private"));
}

#[tokio::test]
async fn contract_report_non_success_status_has_zero_score_and_blocked_indexability() {
    let report = analyze_page(fetch_fixture(404)).await.unwrap();
    assert_eq!(report.http_status, 404);
    assert_eq!(report.health_score, 0);
    assert_eq!(report.indexability.status, "blocked");
    assert_eq!(report.indexability.canonical_target_status, Some(404));
    let issue = report
        .issues
        .iter()
        .find(|issue| issue.code.as_deref() == Some("performance_http_status"))
        .unwrap();
    assert_eq!(issue.severity, IssueSeverity::Critical);
    assert_eq!(issue.params.as_ref().unwrap()["status"], "404");
}
