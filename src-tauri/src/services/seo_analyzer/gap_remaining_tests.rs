use super::images::parse_images;
use super::performance_audit::audit_performance_and_indexability;
use super::transport_audit::audit_transport;
use super::transport_security::detect_mixed_content_resources;
use super::transport_security::enrich_header_technologies;
use crate::models::audit_data::{HttpPerformanceMeasurement, MetaTags};
use crate::services::http_client::FetchResult;
use chrono::Utc;
use std::collections::HashMap;
use url::Url;

#[test]
fn image_dimensions_report_mixed_provenance_for_either_attribute() {
    let html = concat!(
        "<img src='data:image/gif;base64,R0lGODlhBAAFAAAA' alt='one' width='10'>",
        "<img src='data:image/gif;base64,R0lGODlhBAAFAAAA' alt='two' height='5'>"
    );
    let (images, issues) = parse_images(html, &Url::parse("https://example.test").unwrap());
    assert_eq!(images.len(), 2);
    assert!(images
        .iter()
        .all(|image| image.dimensions_source.as_deref() == Some("mixed")));
    assert!(issues.is_empty());
}

#[test]
fn mixed_content_scans_css_urls_and_ignores_empty_style_values() {
    let page = Url::parse("https://example.test/page").unwrap();
    let html = r#"<div style="background:url(http://cdn.example/a.png)"></div>
        <div style="background:url( )"></div><img src="http://cdn.example/a.png">"#;
    let found = detect_mixed_content_resources(html, &page);
    assert_eq!(found, ["http://cdn.example/a.png"]);
}

#[tokio::test]
async fn canonical_status_zero_is_reported_as_unreachable() {
    let result = FetchResult {
        url: "https://example.test".into(),
        final_url: "https://example.test".into(),
        status: 0,
        response_time_ms: 0,
        headers: HashMap::new(),
        repeated_headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: String::new(),
        http_performance: HttpPerformanceMeasurement {
            measured_at: Utc::now(),
            method: "GET".into(),
            response_headers_ms: 0,
            body_read_ms: 0,
            total_request_ms: 0,
            decoded_body_bytes: 0,
            content_length_header_bytes: None,
            redirect_hops: 0,
            scope: "test".into(),
        },
    };
    let (_, issues) = audit_performance_and_indexability(
        &result,
        &MetaTags {
            canonical: Some(result.final_url.clone()),
            ..Default::default()
        },
    )
    .await;
    assert!(issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("meta_canonical_target")));
}

#[test]
fn secure_same_site_cookie_skips_transport_attribute_warnings() {
    let result = audit_transport(
        &HashMap::new(),
        &["sid=1; Secure; HttpOnly; SameSite=Lax".into()],
        "",
        &Url::parse("https://example.test").unwrap(),
    );
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("cookie_secure_missing")));
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("cookie_httponly_missing")));
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("cookie_samesite_missing")));
}

#[test]
fn cloudflare_server_header_is_explicit_edge_evidence() {
    let mut signals = Vec::new();
    enrich_header_technologies(
        &mut signals,
        &HashMap::from([(String::from("server"), String::from("cloudflare"))]),
    );
    assert!(signals.iter().any(|signal| signal.name == "Cloudflare"));
}
