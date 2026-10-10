use super::findings_audit::{collect_amp_issues, collect_structured_data_issues};
use super::indexability::{assess_indexability, contains_noindex, urls_match};
use super::scoring::calculate_health_score;
use super::transport_security::{enrich_header_technologies, parse_header_technology};
use crate::models::audit_data::{
    AmpAudit, AmpFinding, Issue, IssueCategory, IssueSeverity, MetaTags, StructuredData,
    StructuredDataValidationIssue, TechnologySignal,
};
use std::collections::HashMap;

#[test]
fn indexability_contract_covers_directives_url_normalization_and_states() {
    assert!(contains_noindex("Googlebot: NOINDEX, nofollow"));
    assert!(contains_noindex("none"));
    assert!(!contains_noindex("index, follow"));
    assert!(urls_match(
        "https://example.test/page#fragment",
        "https://example.test/page/"
    ));
    assert!(!urls_match(
        "https://example.test/page",
        "https://other.test/page"
    ));
    assert!(urls_match("malformed/", "malformed"));

    let clean = assess_indexability(
        200,
        &MetaTags {
            canonical: Some("https://example.test/page".into()),
            ..Default::default()
        },
        None,
        "https://example.test/page",
    );
    assert_eq!(clean.status, "indexable");
    assert!(clean.reasons.is_empty());

    let blocked = assess_indexability(
        503,
        &MetaTags {
            robots: Some("noindex".into()),
            canonical: Some("https://example.test/other".into()),
            ..Default::default()
        },
        Some("none".into()),
        "https://example.test/page",
    );
    assert_eq!(blocked.status, "blocked");
    assert_eq!(blocked.canonical_matches_final_url, Some(false));
    assert_eq!(blocked.reasons.len(), 4);

    let uncertain =
        assess_indexability(200, &MetaTags::default(), None, "https://example.test/page");
    assert_eq!(uncertain.status, "uncertain");
    assert_eq!(uncertain.reasons.len(), 1);
}

#[test]
fn finding_collectors_map_every_supported_severity_and_payload() {
    let structured = StructuredData {
        data_type: "Product".into(),
        format: "JSON-LD".into(),
        content: serde_json::json!({"@type": "Product"}),
        validation_issues: ["info", "error", "warning", "unexpected"]
            .into_iter()
            .map(|severity| StructuredDataValidationIssue {
                code: "field-missing".into(),
                severity: severity.into(),
                message: format!("{severity} detail"),
                path: None,
                recommendation: Some("Add the field".into()),
            })
            .collect(),
    };
    let issues = collect_structured_data_issues(&[structured]);
    assert_eq!(issues.len(), 4);
    assert_eq!(issues[0].severity, IssueSeverity::Info);
    assert_eq!(issues[1].severity, IssueSeverity::Warning);
    assert_eq!(issues[2].severity, IssueSeverity::Warning);
    assert_eq!(issues[3].severity, IssueSeverity::Info);
    assert_eq!(issues[0].category, IssueCategory::StructuredData);
    assert_eq!(issues[0].params.as_ref().unwrap()["format"], "JSON-LD");

    let amp = AmpAudit {
        findings: ["error", "warning", "info", "other"]
            .into_iter()
            .map(|severity| AmpFinding {
                code: format!("{severity}-code"),
                severity: severity.into(),
                message: "AMP detail".into(),
                evidence: "fixture".into(),
                recommendation: "Fix it".into(),
            })
            .collect(),
        ..Default::default()
    };
    let amp_issues = collect_amp_issues(&amp);
    assert_eq!(amp_issues.len(), 4);
    assert_eq!(amp_issues[0].severity, IssueSeverity::Critical);
    assert_eq!(amp_issues[1].severity, IssueSeverity::Warning);
    assert_eq!(amp_issues[2].severity, IssueSeverity::Info);
    assert_eq!(amp_issues[3].severity, IssueSeverity::Info);
    assert_eq!(amp_issues[0].code.as_deref(), Some("amp_error-code"));
}

#[test]
fn score_and_header_contracts_cover_floor_and_safe_deduplication() {
    let critical = Issue {
        severity: IssueSeverity::Critical,
        category: IssueCategory::Technical,
        code: Some("critical".into()),
        params: None,
        message: "critical".into(),
        recommendation: None,
    };
    assert_eq!(calculate_health_score(&vec![critical.clone(); 8], 200), 0);
    assert_eq!(calculate_health_score(&[critical], 500), 0);
    assert_eq!(
        parse_header_technology("NGINX/1.25.1", &["nginx"]),
        (Some("nginx".into()), Some("1.25.1".into()))
    );
    assert_eq!(
        parse_header_technology("nginx/1.x", &["nginx"]),
        (Some("nginx".into()), None)
    );
    assert_eq!(
        parse_header_technology("nginx 1.25", &["nginx"]),
        (None, None)
    );

    let mut signals = vec![TechnologySignal {
        name: "nginx".into(),
        category: "HTTP server".into(),
        evidence: "old".into(),
        confidence: "confirmed".into(),
        version: None,
    }];
    enrich_header_technologies(
        &mut signals,
        &HashMap::from([(String::from("server"), String::from("nginx/1.25.1"))]),
    );
    assert_eq!(signals.len(), 1);
    assert_eq!(signals[0].evidence, "old");
}
