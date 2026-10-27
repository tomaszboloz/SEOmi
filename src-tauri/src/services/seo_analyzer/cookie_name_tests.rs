use super::assess_cookie_headers;

#[test]
fn cookies_with_empty_or_oversized_names_are_ignored() {
    let long = format!("{}=v; Secure", "a".repeat(129));
    let headers = vec!["=v; Secure".to_string(), long, "ok=v; Secure".to_string()];
    let findings = assess_cookie_headers(&headers);
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].name, "ok");
}
