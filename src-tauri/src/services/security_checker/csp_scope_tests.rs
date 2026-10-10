use super::evaluate_security_headers_with_repeated;
use std::collections::HashMap;

#[test]
fn unsafe_eval_uses_script_src_even_when_script_element_overrides_it() {
    let policy = "script-src 'self' 'unsafe-eval'; script-src-elem 'self'".to_string();
    let repeated = HashMap::from([(
        String::from("content-security-policy"),
        vec![policy.clone()],
    )]);
    let headers = HashMap::from([(String::from("content-security-policy"), policy)]);
    let result = evaluate_security_headers_with_repeated(&headers, &repeated);
    assert!(result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_unsafe")));
}

#[test]
fn duplicate_script_directives_use_the_first_policy() {
    let policy = "script-src *; script-src 'self'; script-src-elem *; script-src-elem 'self'";
    let headers = HashMap::from([(String::from("content-security-policy"), policy.into())]);
    let repeated = HashMap::from([(
        String::from("content-security-policy"),
        vec![policy.to_string()],
    )]);
    let result = evaluate_security_headers_with_repeated(&headers, &repeated);
    assert!(result
        .issues
        .iter()
        .any(|issue| issue.code.as_deref() == Some("security_csp_wildcard")));
}

#[test]
fn script_element_only_policy_still_reports_missing_fallback() {
    let policy = "script-src-elem 'self'".to_string();
    let headers = HashMap::from([(String::from("content-security-policy"), policy.clone())]);
    let repeated = HashMap::from([(String::from("content-security-policy"), vec![policy])]);
    let result = evaluate_security_headers_with_repeated(&headers, &repeated);
    assert!(result
        .issues
        .iter()
        .any(|issue| { issue.code.as_deref() == Some("security_csp_script_scope_missing") }));
}

#[test]
fn malformed_nonce_or_unsupported_hash_does_not_hide_wildcard() {
    for source in ["'nonce-'", "'sha1-invalid'"] {
        let policy = format!("script-src * {source} 'strict-dynamic'");
        let headers = HashMap::from([(String::from("content-security-policy"), policy.clone())]);
        let repeated = HashMap::from([(String::from("content-security-policy"), vec![policy])]);
        let result = evaluate_security_headers_with_repeated(&headers, &repeated);
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code.as_deref() == Some("security_csp_wildcard")));
    }
}

#[test]
fn strict_dynamic_with_nonce_or_hash_disallows_wildcard_and_data() {
    let script_nonce = super::csp_parser::parse_csp("script-src 'nonce-rAnd0m' 'strict-dynamic'");
    assert!(!script_nonce.allows("*"));
    assert!(!script_nonce.allows("data:"));
    assert!(!script_nonce.allows("'unsafe-inline'"));

    let script_hash = super::csp_parser::parse_csp("script-src 'sha256-abc123' 'strict-dynamic'");
    assert!(!script_hash.allows("*"));
    assert!(!script_hash.allows("data:"));

    let elem_hash = super::csp_parser::parse_csp("script-src-elem 'sha384-xyz' 'strict-dynamic'");
    assert!(!elem_hash.allows("*"));
    assert!(!elem_hash.allows("data:"));

    let without_strict = super::csp_parser::parse_csp("script-src * 'nonce-rAnd0m'");
    assert!(without_strict.allows("*"));
}

#[test]
fn duplicate_directives_ignore_subsequent_declarations() {
    let policy = super::csp_parser::parse_csp(
        "default-src 'self'; default-src *; script-src 'self'; script-src *; script-src-elem 'self'; script-src-elem *",
    );
    assert!(policy.allows("'self'"));
    assert!(!policy.allows("*"));
    assert!(!policy.allows("'unsafe-eval'"));
}

#[test]
fn is_nonce_or_hash_recognizes_sha384_and_sha512() {
    assert!(super::csp_parser::is_nonce_or_hash(
        "'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8yC'"
    ));
    assert!(super::csp_parser::is_nonce_or_hash(
        "'sha512-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='"
    ));
    assert!(!super::csp_parser::is_nonce_or_hash("'sha384-'"));
    assert!(!super::csp_parser::is_nonce_or_hash("'sha512-'"));
}

#[test]
fn source_matches_handles_wildcards_and_tokens() {
    assert!(super::csp_parser::source_matches("*.example.com", "*"));
    assert!(super::csp_parser::source_matches("https://*.cdn.net", "*"));
    assert!(!super::csp_parser::source_matches(
        "https://example.com",
        "*"
    ));
    assert!(super::csp_parser::source_matches("data:", "data:"));
    assert!(super::csp_parser::source_matches("DATA:", "data:"));
}
