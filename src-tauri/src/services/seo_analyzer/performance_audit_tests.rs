use super::audit_performance_and_indexability;
use crate::models::audit_data::{HttpPerformanceMeasurement, MetaTags, RedirectHop};
use crate::services::http_client::FetchResult;
use chrono::Utc;
use std::collections::HashMap;

fn fetch(status: u16, response_time_ms: u64, headers: HashMap<String, String>) -> FetchResult {
    FetchResult {
        url: "https://example.com/page".into(),
        final_url: "https://example.com/page".into(),
        status,
        response_time_ms,
        headers,
        repeated_headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: vec![
            RedirectHop {
                url: "https://example.com/a".into(),
                status_code: 301,
                location: Some("/b".into()),
            },
            RedirectHop {
                url: "https://example.com/b".into(),
                status_code: 302,
                location: Some("/c".into()),
            },
            RedirectHop {
                url: "https://example.com/c".into(),
                status_code: 301,
                location: Some("/page".into()),
            },
        ],
        body: String::new(),
        http_performance: HttpPerformanceMeasurement {
            measured_at: Utc::now(),
            method: "GET".into(),
            response_headers_ms: 1,
            body_read_ms: 1,
            total_request_ms: 2,
            decoded_body_bytes: 0,
            content_length_header_bytes: None,
            redirect_hops: 3,
            scope: "fixture".into(),
        },
    }
}

#[tokio::test]
async fn reports_http_latency_redirect_xrobots_and_failed_canonical() {
    let result = fetch(
        404,
        2_001,
        HashMap::from([(String::from("x-robots-tag"), String::from("noindex"))]),
    );
    let meta = MetaTags {
        canonical: Some(result.final_url.clone()),
        ..Default::default()
    };
    let (indexability, issues) = audit_performance_and_indexability(&result, &meta).await;
    let codes: Vec<_> = issues
        .iter()
        .filter_map(|issue| issue.code.as_deref())
        .collect();

    for expected in [
        "performance_http_status",
        "performance_response_slow",
        "performance_redirect_chain",
        "indexability_xrobots_noindex",
        "meta_canonical_target",
    ] {
        assert!(codes.contains(&expected), "missing issue code {expected}");
    }
    assert!(indexability.canonical_target_checked);
    assert_eq!(indexability.canonical_target_status, Some(404));
}

#[tokio::test]
async fn healthy_response_has_no_performance_issue() {
    let mut result = fetch(200, 200, HashMap::new());
    result.redirect_chain.clear();
    let (_, issues) = audit_performance_and_indexability(&result, &MetaTags::default()).await;
    assert!(issues.iter().all(|issue| !issue
        .code
        .as_deref()
        .is_some_and(|code| code.starts_with("performance_"))));
}
