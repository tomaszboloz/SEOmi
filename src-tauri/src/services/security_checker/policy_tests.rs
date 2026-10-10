use super::{audit_cross_origin, audit_information_disclosure};

#[test]
fn information_disclosure_reports_versioned_server_and_powered_by() {
    let mut issues = Vec::new();
    audit_information_disclosure(Some("nginx/1.25.3"), Some("Express"), &mut issues);
    assert_eq!(issues.len(), 2);
    assert_eq!(issues[0].code.as_deref(), Some("security_server_version"));
    assert!(issues[0].message.contains("nginx/1.25.3"));
    assert_eq!(issues[1].code.as_deref(), Some("security_powered_by"));
    assert!(issues[1].message.contains("Express"));

    let mut quiet = Vec::new();
    audit_information_disclosure(Some("nginx"), None, &mut quiet);
    assert!(quiet.is_empty());
}

#[test]
fn cross_origin_policy_only_flags_values_without_same_origin() {
    let mut issues = Vec::new();
    audit_cross_origin(None, &mut issues);
    audit_cross_origin(Some("same-origin"), &mut issues);
    assert!(issues.is_empty());

    audit_cross_origin(Some("unsafe-none"), &mut issues);
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code.as_deref(), Some("security_coop_relaxed"));
    assert!(issues[0].message.contains("unsafe-none"));
}
