use super::super::*;
use super::common::test_http_performance;
use std::collections::HashMap;

#[test]
fn adds_only_explicit_http_technology_evidence() {
    let mut signals = Vec::new();
    enrich_header_technologies(
        &mut signals,
        &HashMap::from([
            ("server".to_string(), "cloudflare".to_string()),
            ("x-powered-by".to_string(), "Express".to_string()),
            ("cf-ray".to_string(), "abc-WAW".to_string()),
        ]),
    );
    assert!(signals.iter().any(|signal| signal.name == "Cloudflare"));
    assert!(signals
        .iter()
        .any(|signal| signal.name == "Application runtime" && signal.evidence.contains("Express")));
    assert!(signals
        .iter()
        .all(|signal| signal.confidence == "confirmed"));
}

#[test]
fn reports_http_technology_versions_only_for_recognized_versioned_signatures() {
    let mut signals = Vec::new();
    enrich_header_technologies(
        &mut signals,
        &HashMap::from([
            ("server".to_string(), "nginx/1.27.4".to_string()),
            ("x-powered-by".to_string(), "PHP/8.3.3".to_string()),
        ]),
    );
    let nginx = signals
        .iter()
        .find(|signal| signal.name == "nginx")
        .unwrap();
    let php = signals.iter().find(|signal| signal.name == "PHP").unwrap();
    assert_eq!(nginx.version.as_deref(), Some("1.27.4"));
    assert_eq!(php.version.as_deref(), Some("8.3.3"));
    assert!(signals
        .iter()
        .all(|signal| signal.confidence == "confirmed"));

    let mut unknown = Vec::new();
    enrich_header_technologies(
        &mut unknown,
        &HashMap::from([("server".to_string(), "mystery/9.8".to_string())]),
    );
    assert_eq!(unknown[0].name, "Web server");
    assert_eq!(unknown[0].version, None);
}

#[test]
fn distinguishes_mixed_content_resources_from_http_navigation_links() {
    let page_url = Url::parse("https://example.com/page").unwrap();
    let html = r#"<html><body>
        <a href="http://example.com/archive">ordinary navigation</a>
        <img src="http://cdn.example.test/photo.jpg?token=secret" srcset="http://cdn.example.test/small.jpg 1x, https://cdn.example.test/large.jpg 2x">
        <script src="//cdn.example.test/app.js"></script>
        <div style="background-image:url('http://cdn.example.test/bg.png?key=secret')"></div>
    </body></html>"#;
    let resources = detect_mixed_content_resources(html, &page_url);
    assert_eq!(resources.len(), 3);
    assert!(resources
        .iter()
        .any(|url| url == "http://cdn.example.test/photo.jpg"));
    assert!(resources
        .iter()
        .any(|url| url == "http://cdn.example.test/small.jpg"));
    assert!(resources
        .iter()
        .any(|url| url == "http://cdn.example.test/bg.png"));
    assert!(resources.iter().all(|url| !url.contains("secret")));
    assert!(resources.iter().all(|url| !url.contains("/archive")));
    assert!(
        detect_mixed_content_resources(html, &Url::parse("http://example.com/").unwrap())
            .is_empty()
    );
}

#[test]
fn cookie_assessment_keeps_only_names_and_security_attributes() {
    let cookies = assess_cookie_headers(&[
        "session=private-value; Path=/; Secure; HttpOnly; SameSite=Lax".into(),
        "prefs=also-private; Path=/".into(),
        "malformed-cookie".into(),
    ]);
    assert_eq!(cookies.len(), 2);
    assert_eq!(cookies[0].name, "session");
    assert!(cookies[0].secure && cookies[0].http_only);
    assert_eq!(cookies[0].same_site.as_deref(), Some("Lax"));
    assert_eq!(cookies[1].name, "prefs");
    assert!(!cookies[1].secure && !cookies[1].http_only);
    let serialized = serde_json::to_string(&cookies).unwrap();
    assert!(!serialized.contains("private-value"));
    assert!(!serialized.contains("also-private"));
}

#[tokio::test]
async fn saves_transport_and_cookie_findings_without_cookie_values() {
    let fetch = FetchResult {
        url: "https://example.com/secure".into(),
        final_url: "https://example.com/secure".into(),
        status: 200,
        response_time_ms: 100,
        headers: HashMap::new(),
        repeated_headers: HashMap::new(),
        set_cookie_headers: vec!["session=super-secret-value; Path=/; HttpOnly".into()],
        redirect_chain: Vec::new(),
        body: "<html><head><title>Security findings fixture page</title></head><body><main><h1>Page</h1><a href=\"http://example.com/ordinary-navigation\">HTTP link</a><script src=\"http://cdn.example.test/app.js?token=private\"></script></main></body></html>".into(),
        http_performance: test_http_performance(),
    };

    let report = analyze_page(fetch).await.unwrap();
    let transport = report.transport_security.as_ref().unwrap();
    assert!(transport.https);
    assert_eq!(
        transport.mixed_content_urls,
        ["http://cdn.example.test/app.js"]
    );
    assert_eq!(transport.cookies[0].name, "session");
    assert!(!transport.cookies[0].secure);
    assert!(transport.cookies[0].http_only);
    assert!(report
        .issues
        .iter()
        .any(|i| i.message.contains("mixed content")));
    let serialized = serde_json::to_string(&report).unwrap();
    assert!(!serialized.contains("super-secret-value"));
    assert!(!serialized.contains("token=private"));
    assert!(serialized.contains("ordinary-navigation"));
}
