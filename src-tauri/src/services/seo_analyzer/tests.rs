use super::headings::build_heading_tree;
use super::images::intrinsic_data_uri_dimensions;
use super::*;
use crate::models::audit_data::{HttpPerformanceMeasurement, MetaTags};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

use std::collections::HashMap;

fn test_http_performance() -> HttpPerformanceMeasurement {
    HttpPerformanceMeasurement {
        measured_at: Utc::now(),
        method: "GET".into(),
        response_headers_ms: 100,
        body_read_ms: 2,
        total_request_ms: 102,
        decoded_body_bytes: 64,
        content_length_header_bytes: None,
        redirect_hops: 0,
        scope: "native_http_get_includes_redirects_no_browser_render".into(),
    }
}

#[tokio::test]
async fn invalid_fetch_urls_return_an_error_without_panicking() {
    let fetch = FetchResult {
        url: "invalid source URL".into(),
        final_url: "invalid response URL".into(),
        status: 200,
        response_time_ms: 0,
        headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: String::new(),
        http_performance: test_http_performance(),
    };
    assert!(analyze_page(fetch).await.is_err());
}

#[tokio::test]
async fn test_analyze_page_healthy() {
    let html = r#"
    <!DOCTYPE html>
    <html>
      <head>
        <title>Optimal Page Title For Search Engine Testing | SEOmi</title>
        <meta name="description" content="A perfectly sized meta description that easily conveys the complete topic of the article to visitors and search engines alike.">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="canonical" href="https://example.com/test">
        <meta property="og:title" content="Optimal Page Title">
      </head>
      <body>
        <h1>Main Topic Header</h1>
        <p>Content text</p>
        <h2>Sub Topic Header</h2>
        <img src="/logo.png" alt="Company Logo" width="100" height="100">
        <a href="/about">About Us</a>
      </body>
    </html>
    "#;

    let fetch = FetchResult {
        url: "https://example.com/test".to_string(),
        final_url: "https://example.com/test".to_string(),
        status: 200,
        response_time_ms: 150,
        headers: HashMap::from([
            (
                "strict-transport-security".to_string(),
                "max-age=31536000".to_string(),
            ),
            (
                "content-security-policy".to_string(),
                "default-src 'self'".to_string(),
            ),
            ("x-frame-options".to_string(), "DENY".to_string()),
            ("x-content-type-options".to_string(), "nosniff".to_string()),
        ]),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: html.to_string(),
        http_performance: test_http_performance(),
    };

    let result = analyze_page(fetch).await.unwrap();
    assert!(result.health_score >= 80);
    assert_eq!(result.headings.h1_count, 1);
    assert_eq!(result.images.len(), 1);
    assert!(result.images[0].has_alt);
    assert_eq!(result.links.total_links, 1);
    assert!(result.links.links[0].is_internal);
    assert_eq!(result.indexability.status, "indexable");
    assert_eq!(
        result
            .http_performance
            .as_ref()
            .unwrap()
            .response_headers_ms,
        100
    );
    assert_eq!(
        result.http_performance.as_ref().unwrap().decoded_body_bytes,
        64
    );
}

#[tokio::test]
async fn schema_validation_findings_are_added_to_the_saved_audit_issues() {
    let html = r#"<!DOCTYPE html><html lang="en"><head>
      <title>Structured data validation test page title</title>
      <meta name="description" content="This description is long enough to remain a stable fixture for the local schema validation test and audit.">
      <meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/product">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","description":"No required profile fields"}</script>
    </head><body><h1>Product test</h1><main><p>Visible content.</p></main></body></html>"#;
    let fetch = FetchResult {
        url: "https://example.com/product".into(),
        final_url: "https://example.com/product".into(),
        status: 200,
        response_time_ms: 120,
        headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: html.into(),
        http_performance: test_http_performance(),
    };

    let result = analyze_page(fetch).await.unwrap();
    assert!(result.structured_data[0]
        .validation_issues
        .iter()
        .any(|item| item.code == "product-name-missing"));
    assert!(result.issues.iter().any(|item| {
        item.category == IssueCategory::StructuredData
            && item.code.as_deref() == Some("structured_validation")
            && item.message.contains("Product has no name")
            && item
                .params
                .as_ref()
                .and_then(|params| params.get("detail"))
                .is_some_and(|detail| detail.contains("Product has no name"))
    }));
}

#[tokio::test]
async fn amp_local_findings_are_persisted_and_affect_the_audit_score() {
    let fetch = FetchResult {
        url: "https://example.com/amp".into(),
        final_url: "https://example.com/amp".into(),
        status: 200,
        response_time_ms: 100,
        headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: "<html amp><head></head><body><p>AMP test</p></body></html>".into(),
        http_performance: test_http_performance(),
    };

    let report = analyze_page(fetch).await.unwrap();
    assert!(report.amp.is_amp_document);
    assert!(report
        .amp
        .findings
        .iter()
        .any(|finding| finding.code == "amp-canonical-missing"));
    assert!(report
        .issues
        .iter()
        .any(|issue| issue.message.contains("[amp-canonical-missing]")));
    assert!(report.health_score < 100);
}

#[tokio::test]
async fn accessibility_findings_are_added_to_the_audit_and_health_score() {
    let fetch = FetchResult {
        url: "https://example.com/accessibility".into(),
        final_url: "https://example.com/accessibility".into(),
        status: 200,
        response_time_ms: 100,
        headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: "<!doctype html><html lang=\"en_US\"><head><title>Accessibility audit test page</title><meta name=\"description\" content=\"A long enough description for an audit fixture that contains stable text for the page.\"><meta name=\"viewport\" content=\"width=device-width\"><link rel=\"canonical\" href=\"https://example.com/accessibility\"></head><body><main><h1>Accessibility</h1><input type=\"email\" name=\"contact\" value=\"must-not-leak\"><button></button><img src=\"/chart.png\"></main></body></html>".into(),
        http_performance: test_http_performance(),
    };

    let result = analyze_page(fetch).await.unwrap();
    assert!(result
        .accessibility
        .findings
        .iter()
        .any(|finding| finding.code == "accessibility-document-language-invalid"));
    assert!(result.issues.iter().any(|issue| issue
        .message
        .contains("Dostępność · accessibility-image-alt-missing")));
    let unlabeled_issue = result
        .issues
        .iter()
        .find(|issue| {
            issue
                .message
                .contains("accessibility-form-controls-unlabeled")
        })
        .unwrap();
    assert_eq!(
        unlabeled_issue.code.as_deref(),
        Some("accessibility-form-controls-unlabeled")
    );
    assert_eq!(
        unlabeled_issue
            .params
            .as_ref()
            .and_then(|params| params.get("unlabeled"))
            .map(String::as_str),
        Some("1")
    );
    assert_eq!(
        unlabeled_issue
            .params
            .as_ref()
            .and_then(|params| params.get("total"))
            .map(String::as_str),
        Some("1")
    );
    assert!(unlabeled_issue
        .recommendation
        .as_deref()
        .unwrap_or_default()
        .contains("document.querySelectorAll('input, select, textarea')[0]"));
    assert!(result
        .accessibility
        .findings
        .iter()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
        .unwrap()
        .elements
        .iter()
        .all(|element| !element.html_snippet.contains("must-not-leak")));
    assert!(result.health_score < 100);
}

#[test]
fn detects_noindex_from_x_robots_tag() {
    let meta = MetaTags {
        canonical: Some("https://example.com/page".to_string()),
        ..Default::default()
    };
    let assessment = assess_indexability(
        200,
        &meta,
        Some("googlebot: noindex, nofollow".to_string()),
        "https://example.com/page",
    );

    assert_eq!(assessment.status, "blocked");
    assert!(assessment
        .reasons
        .iter()
        .any(|reason| reason.contains("X-Robots-Tag")));
}

#[tokio::test]
async fn x_robots_noindex_is_exposed_in_the_audit_and_health_issues() {
    let fetch = FetchResult {
        url: "https://example.com/page".to_string(),
        final_url: "https://example.com/page".to_string(),
        status: 200,
        response_time_ms: 120,
        headers: HashMap::from([("x-robots-tag".to_string(), "noindex".to_string())]),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: "<html><head><title>Wystarczająco długi tytuł testowej strony</title><meta name=\"description\" content=\"Wystarczająco długi opis testowej strony dla walidacji lokalnego audytu.\"><meta name=\"viewport\" content=\"width=device-width\"><link rel=\"canonical\" href=\"https://example.com/page\"></head><body><h1>Temat</h1></body></html>".to_string(),
        http_performance: test_http_performance(),
    };

    let result = analyze_page(fetch).await.unwrap();
    assert_eq!(result.indexability.status, "blocked");
    assert!(result.issues.iter().any(|issue| {
        issue.code.as_deref() == Some("indexability_xrobots_noindex")
            && issue.message.contains("X-Robots-Tag")
    }));
}

#[test]
fn marks_different_canonical_as_uncertain_without_calling_it_a_block() {
    let meta = MetaTags {
        canonical: Some("https://example.com/preferred".to_string()),
        ..Default::default()
    };
    let assessment = assess_indexability(200, &meta, None, "https://example.com/alternate");

    assert_eq!(assessment.status, "uncertain");
    assert_eq!(assessment.canonical_matches_final_url, Some(false));
}

#[test]
fn structured_data_warning_reduces_the_health_score() {
    let structured_data_issue = Issue {
        severity: IssueSeverity::Warning,
        category: IssueCategory::StructuredData,
        code: Some("structured_validation".into()),
        params: None,
        message: "JSON-LD Product has no name".into(),
        recommendation: Some("Add a name property.".into()),
    };

    assert_eq!(calculate_health_score(&[], 200), 100);
    assert_eq!(calculate_health_score(&[structured_data_issue], 200), 95);
}

#[tokio::test]
async fn rejects_private_canonical_target_without_sending_a_request() {
    let mut assessment = assess_indexability(
        200,
        &MetaTags {
            canonical: Some("http://127.0.0.1/internal".to_string()),
            ..Default::default()
        },
        None,
        "https://example.com/page",
    );

    verify_canonical_target(&mut assessment, 200).await;
    assert!(!assessment.canonical_target_checked);
    assert!(assessment
        .canonical_target_check_error
        .as_deref()
        .is_some_and(|value| value.contains("not requested")));
}

#[tokio::test]
async fn reuses_current_http_status_for_a_self_canonical() {
    let mut assessment = assess_indexability(
        200,
        &MetaTags {
            canonical: Some("https://example.com/page".to_string()),
            ..Default::default()
        },
        None,
        "https://example.com/page",
    );

    verify_canonical_target(&mut assessment, 200).await;
    assert!(assessment.canonical_target_checked);
    assert_eq!(assessment.canonical_target_status, Some(200));
}

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
        .any(|issue| issue.message.contains("mixed content")));
    let serialized = serde_json::to_string(&report).unwrap();
    assert!(!serialized.contains("super-secret-value"));
    assert!(!serialized.contains("token=private"));
    assert!(serialized.contains("ordinary-navigation"));
}

#[test]
fn test_missing_h1_issue() {
    let html = "<html><body><h2>No H1 here</h2></body></html>";
    let (headings, issues) = parse_headings(html);
    assert_eq!(headings.h1_count, 0);
    assert!(issues.iter().any(|i| i.message.contains("No H1")));
}

#[test]
fn test_multiple_h1_issue() {
    let html = "<html><body><h1>First H1</h1><h1>Second H1</h1></body></html>";
    let (headings, issues) = parse_headings(html);
    assert_eq!(headings.h1_count, 2);
    assert!(issues.iter().any(|i| i.message.contains("Multiple H1")));
}

#[test]
fn builds_a_nested_heading_tree_without_losing_siblings() {
    let tree = build_heading_tree(&[
        (1, "Root".to_string()),
        (2, "First child".to_string()),
        (3, "Grandchild".to_string()),
        (2, "Second child".to_string()),
        (1, "Second root".to_string()),
    ]);

    assert_eq!(tree.len(), 2);
    assert_eq!(tree[0].children.len(), 2);
    assert_eq!(tree[0].children[0].children[0].text, "Grandchild");
    assert_eq!(tree[0].children[1].text, "Second child");
}

#[test]
fn test_images_missing_alt() {
    let html =
        r#"<html><body><img src="pic1.jpg"><img src="pic2.jpg" alt="Description"></body></html>"#;
    let base = Url::parse("https://example.com").unwrap();
    let (images, issues) = parse_images(html, &base);

    assert_eq!(images.len(), 2);
    assert!(!images[0].has_alt);
    assert!(images[1].has_alt);
    assert!(issues.iter().any(|i| i.message.contains("missing 'alt'")));
}

#[test]
fn empty_alt_is_decorative_without_requiring_aria_hidden_or_role() {
    let base = Url::parse("https://example.com").unwrap();
    let (images, issues) = parse_images(
        r#"<img src="decoration.png" alt=""><img src="missing.png">"#,
        &base,
    );
    assert!(images[0].has_alt);
    assert!(!images[1].has_alt);
    let missing = issues
        .iter()
        .find(|issue| issue.message.contains("missing 'alt'"))
        .unwrap();
    assert_eq!(missing.params.as_ref().unwrap().get("count").unwrap(), "1");
}

#[test]
fn infers_intrinsic_dimensions_from_bounded_data_uris_without_network() {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    png[16..20].copy_from_slice(&2u32.to_be_bytes());
    png[20..24].copy_from_slice(&3u32.to_be_bytes());
    let png_uri = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png));
    assert_eq!(intrinsic_data_uri_dimensions(&png_uri), Some((2, 3)));

    let svg_uri = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20120%2060%22%3E%3C/svg%3E";
    assert_eq!(intrinsic_data_uri_dimensions(svg_uri), Some((120, 60)));

    let percentage_svg = "data:image/svg+xml,%3Csvg%20width%3D%22100%25%22%20height%3D%2250%25%22%20viewBox%3D%220%200%2080%2040%22%3E%3C/svg%3E";
    assert_eq!(
        intrinsic_data_uri_dimensions(percentage_svg),
        Some((80, 40))
    );
}

#[test]
fn parse_images_marks_intrinsic_dimensions_as_local_evidence() {
    let html = r#"<html><body><img src="data:image/gif;base64,R0lGODlhBAAFAAAA" alt="pixel"></body></html>"#;
    let base = Url::parse("https://example.com").unwrap();
    let (images, issues) = parse_images(html, &base);
    assert_eq!(images[0].width.as_deref(), Some("4"));
    assert_eq!(images[0].height.as_deref(), Some("5"));
    assert_eq!(
        images[0].dimensions_source.as_deref(),
        Some("intrinsic-data-uri")
    );
    assert!(!issues
        .iter()
        .any(|issue| issue.message.contains("missing explicit width/height")));
}

#[test]
fn test_links_target_blank_security() {
    let html =
        r#"<html><body><a href="https://other.com" target="_blank">External</a></body></html>"#;
    let base = Url::parse("https://example.com").unwrap();
    let (links, issues) = parse_links(html, &base);

    assert_eq!(links.total_links, 1);
    assert_eq!(links.external_links, 1);
    assert!(issues
        .iter()
        .any(|i| i.message.contains("noopener noreferrer")));
}
