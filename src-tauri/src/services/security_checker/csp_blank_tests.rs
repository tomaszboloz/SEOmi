use super::csp_parser::parse_csp;

#[path = "csp_gap_tests.rs"]
mod csp_gap_tests;

#[path = "csp_fallback_contract_tests.rs"]
mod csp_fallback_contract_tests;

#[test]
fn blank_directives_between_semicolons_are_skipped() {
    let policy = parse_csp(" ; ;; default-src 'self' ;");
    assert_eq!(policy.script_scope(), Some(&vec!["'self'".to_string()]));
    assert!(parse_csp(" ; ").script_scope().is_none());
}
