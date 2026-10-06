use super::{
    accessibility::audit_accessibility, indexability::verify_canonical_target,
    metadata::audit_meta_tags, transport_audit::audit_transport,
    transport_security::assess_cookie_headers,
};
use crate::models::audit_data::{
    AccessibilityAudit, AccessibilityElementEvidence, AccessibilityFinding, MetaTags,
};
use std::collections::HashMap;
use url::Url;

#[test]
fn short_description_reports_its_character_count() {
    let issues = audit_meta_tags(
        &MetaTags {
            title: Some("A title with enough text".into()),
            description: Some("brief".into()),
            canonical: Some("https://example.com/page".into()),
            viewport: Some("width=device-width".into()),
            ..Default::default()
        },
        &Url::parse("https://example.com/page").unwrap(),
    );
    let issue = issues
        .iter()
        .find(|issue| issue.code.as_deref() == Some("meta_description_short"))
        .expect("short description issue");
    assert_eq!(
        issue.params.as_ref().and_then(|params| params.get("count")),
        Some(&"5".into())
    );
    assert_eq!(issues.len(), 1);
}

#[test]
fn transport_audit_reports_scheme_mixed_content_and_cookie_attributes() {
    let http = audit_transport(
        &HashMap::new(),
        &["sid=abc".into()],
        "",
        &Url::parse("http://example.com/page").unwrap(),
    );
    assert!(!http.transport_security.https);
    assert!(http
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("transport_http")));

    let https = audit_transport(
        &HashMap::new(),
        &["sid=abc".into()],
        r#"<img src="http://cdn.example/image.png">"#,
        &Url::parse("https://example.com/page").unwrap(),
    );
    assert_eq!(
        https.transport_security.mixed_content_urls,
        ["http://cdn.example/image.png"]
    );
    for code in [
        "transport_mixed_content",
        "cookie_secure_missing",
        "cookie_httponly_missing",
        "cookie_samesite_missing",
    ] {
        assert!(
            https
                .issues
                .iter()
                .any(|issue| issue.code.as_deref() == Some(code)),
            "missing {code}"
        );
    }
}

#[test]
fn cookie_parser_filters_invalid_names_and_normalizes_same_site() {
    let findings = assess_cookie_headers(&[
        "strict=1; sEcUrE; HTTPONLY; SameSite=STRICT".into(),
        "lax=1; SameSite=lax".into(),
        "none=1; SameSite=none".into(),
        "invalid=1; SameSite=unknown".into(),
        "bad name=1".into(),
        "malformed".into(),
    ]);
    assert_eq!(findings.len(), 4);
    assert_eq!(findings[0].same_site.as_deref(), Some("Strict"));
    assert_eq!(findings[1].same_site.as_deref(), Some("Lax"));
    assert_eq!(findings[2].same_site.as_deref(), Some("None"));
    assert_eq!(findings[3].same_site, None);
    assert!(findings[0].secure && findings[0].http_only);
}

#[test]
fn accessibility_default_severity_and_capped_locations_are_preserved() {
    let finding = AccessibilityFinding {
        code: "accessibility-custom-check".into(),
        severity: "notice".into(),
        message: "Found 6 affected controls".into(),
        evidence: "fixture".into(),
        recommendation: "Review the controls".into(),
        elements: (1..=6)
            .map(|position| AccessibilityElementEvidence {
                dom_position: position,
                dom_query: format!("button:nth-of-type({position})"),
                html_snippet: "<button>".into(),
                line: None,
                column: None,
            })
            .collect(),
    };
    let issues = audit_accessibility(&AccessibilityAudit {
        findings: vec![finding],
        ..Default::default()
    });
    let issue = &issues[0];
    assert_eq!(
        issue.severity,
        crate::models::audit_data::IssueSeverity::Info
    );
    assert_eq!(
        issue.params.as_ref().and_then(|params| params.get("count")),
        Some(&"6".into())
    );
    let recommendation = issue.recommendation.as_deref().unwrap();
    assert!(recommendation.contains("#1 button:nth-of-type(1)"));
    assert!(recommendation.contains("#5 button:nth-of-type(5)"));
    assert!(!recommendation.contains("#6 button:nth-of-type(6)"));
    assert!(recommendation.contains("jeszcze 1"));
}

#[tokio::test]
async fn canonical_verification_without_target_stays_unchecked() {
    let mut assessment = crate::models::audit_data::IndexabilityAssessment::default();
    verify_canonical_target(&mut assessment, 200).await;
    assert!(!assessment.canonical_target_checked);
    assert!(assessment.canonical_target_status.is_none());
    assert!(assessment.canonical_target_check_error.is_none());
}
