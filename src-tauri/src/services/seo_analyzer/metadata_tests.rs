use crate::models::audit_data::{HttpPerformanceMeasurement, IssueCategory};
use crate::services::http_client::FetchResult;
use crate::services::seo_analyzer::analyze_page;
use chrono::Utc;
use std::collections::HashMap;

fn test_http_performance() -> HttpPerformanceMeasurement {
    HttpPerformanceMeasurement {
        measured_at: Utc::now(),
        method: "GET".into(),
        response_headers_ms: 1,
        body_read_ms: 1,
        total_request_ms: 2,
        decoded_body_bytes: 64,
        content_length_header_bytes: None,
        redirect_hops: 0,
        scope: "native_http_get_includes_redirects_no_browser_render".into(),
    }
}

#[tokio::test]
async fn audits_long_metadata_and_noindex_from_real_html() {
    let html = r#"<!doctype html><html><head>
      <title>This SEO audit fixture deliberately uses a title longer than sixty-five characters</title>
      <meta name="description" content="This deliberately verbose metadata fixture contains more than one hundred and sixty-five characters so the local audit can report a truncation risk without contacting an external service or inventing page data.">
      <meta name="robots" content="NoIndex, follow"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="canonical" href="https://example.com/metadata">
    </head><body><main><h1>Metadata fixture</h1><p>Stable local audit content.</p></main></body></html>"#;
    let result = analyze_page(FetchResult {
        url: "https://example.com/metadata".into(),
        final_url: "https://example.com/metadata".into(),
        status: 200,
        response_time_ms: 12,
        headers: HashMap::new(),
        repeated_headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: html.into(),
        http_performance: test_http_performance(),
    })
    .await
    .expect("fixture should produce an audit");

    assert!(result.meta_tags.title_length > 65);
    assert!(result.meta_tags.description_length > 165);
    let metadata_issue = |code: &str| {
        result.issues.iter().find(|issue| {
            issue.category == IssueCategory::MetaTags && issue.code.as_deref() == Some(code)
        })
    };
    let title = metadata_issue("meta_title_long").expect("long title finding");
    assert_eq!(
        title
            .params
            .as_ref()
            .and_then(|params| params.get("count"))
            .map(String::as_str),
        Some("82")
    );
    let description = metadata_issue("meta_description_long").expect("long description finding");
    assert_eq!(
        description
            .params
            .as_ref()
            .and_then(|params| params.get("count"))
            .map(String::as_str),
        Some("210")
    );
    let robots = metadata_issue("meta_robots_noindex").expect("noindex finding");
    assert_eq!(
        robots
            .params
            .as_ref()
            .and_then(|params| params.get("value"))
            .map(String::as_str),
        Some("NoIndex, follow")
    );
}
