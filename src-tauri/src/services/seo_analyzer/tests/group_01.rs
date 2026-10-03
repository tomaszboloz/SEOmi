use super::common::test_http_performance;
use super::super::*;
use std::collections::HashMap;

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
            ("strict-transport-security".to_string(), "max-age=31536000".to_string()),
            ("content-security-policy".to_string(), "default-src 'self'".to_string()),
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
    assert_eq!(result.http_performance.as_ref().unwrap().response_headers_ms, 100);
    assert_eq!(result.http_performance.as_ref().unwrap().decoded_body_bytes, 64);
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
    assert!(result.structured_data[0].validation_issues.iter().any(|i| i.code == "product-name-missing"));
    assert!(result.issues.iter().any(|item| {
        item.category == IssueCategory::StructuredData
            && item.code.as_deref() == Some("structured_validation")
            && item.message.contains("Product has no name")
            && item.params.as_ref().and_then(|p| p.get("detail")).is_some_and(|d| d.contains("Product has no name"))
    }));
}
