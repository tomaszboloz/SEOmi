use super::{audit_csp, audit_x_content_type, audit_x_frame};
use crate::models::audit_data::Issue;

#[test]
fn core_header_rules_flag_invalid_nosniff_and_unsafe_eval_but_accept_sameorigin() {
    let mut score = 100;
    let mut issues = Vec::<Issue>::new();
    audit_x_content_type(Some("sniff"), &mut score, &mut issues);
    assert_eq!(score, 90);
    assert_eq!(issues[0].code.as_deref(), Some("security_xcontent_invalid"));

    let mut score = 100;
    let mut issues = Vec::new();
    audit_csp(Some("script-src 'unsafe-eval'"), &mut score, &mut issues);
    assert_eq!(score, 90);
    assert_eq!(issues[0].code.as_deref(), Some("security_csp_unsafe"));

    let mut score = 100;
    let mut issues = Vec::new();
    audit_x_frame(Some("SAMEORIGIN"), &mut score, &mut issues);
    assert_eq!(score, 100);
    assert!(issues.is_empty());
}
