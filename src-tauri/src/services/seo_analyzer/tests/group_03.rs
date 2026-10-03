use super::super::*;
use super::common::test_http_performance;
use crate::models::audit_data::MetaTags;
use std::collections::HashMap;

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
        .any(|r| r.contains("X-Robots-Tag")));
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
        .is_some_and(|v| v.contains("not requested")));
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
