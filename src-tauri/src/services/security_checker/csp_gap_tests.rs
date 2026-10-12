use crate::services::security_checker::csp_parser::parse_csp;

#[test]
fn csp_without_script_or_default_sources_allows_unlisted_tokens() {
    let policy = parse_csp("report-uri /csp-report");
    assert!(policy.script_scope().is_none());
    assert!(policy.allows("https://cdn.example/script.js"));
    assert!(policy.allows("'unsafe-inline'"));
}

#[test]
fn csp_default_sources_are_used_when_script_sources_are_absent() {
    let policy = parse_csp("default-src 'self'");
    assert!(policy.allows("'self'"));
    assert!(!policy.allows("https://cdn.example/script.js"));
}
