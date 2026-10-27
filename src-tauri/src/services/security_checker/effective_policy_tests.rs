use super::{effective_referrer_policy, evaluate_security_headers_with_repeated};
use std::collections::HashMap;

fn audit(values: &[(&str, Vec<&str>)]) -> super::SecurityAuditResult {
    let repeated = values
        .iter()
        .map(|(name, values)| {
            (
                name.to_string(),
                values
                    .iter()
                    .map(|value| value.to_string())
                    .collect::<Vec<_>>(),
            )
        })
        .collect::<HashMap<_, _>>();
    let headers: HashMap<String, String> = repeated
        .iter()
        .filter_map(|(name, values)| values.last().map(|value| (name.clone(), value.clone())))
        .collect();
    evaluate_security_headers_with_repeated(&headers, &repeated)
}

#[test]
fn hsts_zero_and_short_lifetimes_are_findings() {
    for (value, code) in [
        ("max-age=0", "security_hsts_disabled"),
        ("max-age=60", "security_hsts_short"),
    ] {
        let result = audit(&[("strict-transport-security", vec![value])]);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code.as_deref() == Some(code)));
    }
}

#[test]
fn hsts_uses_first_repeated_field_and_does_not_skip_invalid_duplicate() {
    let result = audit(&[(
        "strict-transport-security",
        vec!["max-age=broken", "max-age=31536000"],
    )]);
    assert!(result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_hsts_invalid")));
    assert_eq!(
        result.headers.repeated_headers["strict-transport-security"].len(),
        2
    );
    let duplicate = audit(&[(
        "strict-transport-security",
        vec!["max-age=60; max-age=31536000"],
    )]);
    assert!(duplicate
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_hsts_invalid")));
}

#[test]
fn report_only_is_distinct_from_a_missing_enforced_policy() {
    let result = audit(&[(
        "content-security-policy-report-only",
        vec!["default-src 'self'"],
    )]);
    assert!(result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_report_only")));
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_missing")));
    assert_eq!(
        result
            .headers
            .content_security_policy_report_only
            .as_deref(),
        Some("default-src 'self'")
    );
}

#[test]
fn referrer_policy_uses_last_valid_value_and_flags_unsafe_url() {
    let values = vec![
        "unsafe-url, invalid".to_string(),
        "origin".to_string(),
        "unsafe-url".to_string(),
    ];
    assert_eq!(
        effective_referrer_policy(&values).as_deref(),
        Some("unsafe-url")
    );
    let result = audit(&[(
        "referrer-policy",
        values.iter().map(String::as_str).collect(),
    )]);
    assert!(result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_referrer_unsafe")));
    assert_eq!(
        result.headers.referrer_policy.as_deref(),
        Some("unsafe-url")
    );
}

#[test]
fn restrictive_csp_intersection_removes_permissive_wildcard_and_data() {
    let result = audit(&[(
        "content-security-policy",
        vec![
            "default-src * data:",
            "default-src 'self'; script-src 'self'",
        ],
    )]);
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_wildcard")));
    assert!(!result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_data_script")));
}

#[test]
fn script_element_scope_and_nonce_are_used_for_injected_script_checks() {
    let scoped = audit(&[(
        "content-security-policy",
        vec!["default-src 'self'; script-src *; script-src-elem 'self'"],
    )]);
    assert!(!scoped
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_wildcard")));
    let nonce = audit(&[(
        "content-security-policy",
        vec!["script-src * 'nonce-abc' 'strict-dynamic'"],
    )]);
    assert!(!nonce
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_wildcard")));
}
