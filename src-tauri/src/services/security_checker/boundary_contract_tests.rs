use super::{
    audit_csp, audit_hsts, audit_referrer, audit_referrer_values, effective_referrer_policy,
};
use crate::models::audit_data::Issue;

fn codes(issues: &[Issue]) -> Vec<&str> {
    issues
        .iter()
        .filter_map(|issue| issue.code.as_deref())
        .collect()
}

#[test]
fn hsts_wrapper_covers_missing_directive_duplicates_and_lengths() {
    let cases = [
        (None, 75, vec!["security_hsts_missing"]),
        (
            Some("includeSubDomains=ignored; max-age=31536000"),
            100,
            vec![],
        ),
        (Some("max-age=0"), 80, vec!["security_hsts_disabled"]),
        (Some("max-age=15551999"), 90, vec!["security_hsts_short"]),
        (Some("max-age=unknown"), 90, vec!["security_hsts_invalid"]),
        (
            Some("max-age=1; max-age=2"),
            90,
            vec!["security_hsts_invalid"],
        ),
    ];
    for (header, expected_score, expected_codes) in cases {
        let mut score = 100;
        let mut issues = Vec::new();
        audit_hsts(header, &mut score, &mut issues);
        assert_eq!(score, expected_score, "header: {header:?}");
        assert_eq!(codes(&issues), expected_codes, "header: {header:?}");
    }
}

#[test]
fn referrer_wrapper_distinguishes_missing_invalid_and_unsafe_policies() {
    let cases = [
        (None, 95, "security_referrer_missing"),
        (Some("future-policy"), 95, "security_referrer_invalid"),
        (Some("unsafe-url"), 95, "security_referrer_unsafe"),
    ];
    for (header, expected_score, expected_code) in cases {
        let mut score = 100;
        let mut issues = Vec::new();
        audit_referrer(header, &mut score, &mut issues);
        assert_eq!(score, expected_score, "header: {header:?}");
        assert_eq!(codes(&issues), [expected_code], "header: {header:?}");
    }
    let values = vec!["invalid".to_string(), "ORIGIN".to_string()];
    assert_eq!(
        effective_referrer_policy(&values).as_deref(),
        Some("origin")
    );
    let mut score = 100;
    let mut issues = Vec::new();
    audit_referrer_values(&values, &mut score, &mut issues);
    assert_eq!(score, 100);
    assert!(issues.is_empty());
}

#[test]
fn csp_wrapper_reports_scope_and_script_source_violations() {
    let mut score = 100;
    let mut issues = Vec::new();
    audit_csp(None, &mut score, &mut issues);
    assert_eq!(score, 75);
    assert_eq!(codes(&issues), ["security_csp_missing"]);

    let mut score = 100;
    let mut issues = Vec::new();
    audit_csp(Some("img-src 'self'"), &mut score, &mut issues);
    assert_eq!(score, 90);
    assert_eq!(codes(&issues), ["security_csp_script_scope_missing"]);

    let mut score = 100;
    let mut issues = Vec::new();
    audit_csp(
        Some("script-src * data: 'unsafe-inline' 'unsafe-eval'"),
        &mut score,
        &mut issues,
    );
    assert_eq!(score, 60);
    assert_eq!(issues.len(), 4);
    assert!(issues
        .iter()
        .all(|issue| issue.code.as_deref() == Some("security_csp_unsafe")
            || issue.code.as_deref() == Some("security_csp_wildcard")
            || issue.code.as_deref() == Some("security_csp_data_script")));
}
