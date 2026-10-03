use super::common::test_http_performance;
use super::super::*;
use std::collections::HashMap;

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
    assert!(report.amp.findings.iter().any(|f| f.code == "amp-canonical-missing"));
    assert!(report.issues.iter().any(|i| i.message.contains("[amp-canonical-missing]")));
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
    assert!(result.accessibility.findings.iter().any(|f| f.code == "accessibility-document-language-invalid"));
    assert!(result.issues.iter().any(|i| i.message.contains("Dostępność · accessibility-image-alt-missing")));
    let unlabeled_issue = result.issues.iter()
        .find(|i| i.message.contains("accessibility-form-controls-unlabeled"))
        .unwrap();
    assert_eq!(unlabeled_issue.code.as_deref(), Some("accessibility-form-controls-unlabeled"));
    assert_eq!(unlabeled_issue.params.as_ref().and_then(|p| p.get("unlabeled")).map(String::as_str), Some("1"));
    assert_eq!(unlabeled_issue.params.as_ref().and_then(|p| p.get("total")).map(String::as_str), Some("1"));
    assert!(unlabeled_issue.recommendation.as_deref().unwrap_or_default().contains("document.querySelectorAll('input, select, textarea')[0]"));
    assert!(result.accessibility.findings.iter()
        .find(|f| f.code == "accessibility-form-controls-unlabeled")
        .unwrap().elements.iter().all(|e| !e.html_snippet.contains("must-not-leak")));
    assert!(result.health_score < 100);
}
