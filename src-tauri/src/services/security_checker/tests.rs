use super::*;
use std::collections::HashMap;

#[test]
fn test_perfect_security_headers() {
    let mut map = HashMap::new();
    map.insert(
        "strict-transport-security".to_string(),
        "max-age=31536000; includeSubDomains; preload".to_string(),
    );
    map.insert(
        "content-security-policy".to_string(),
        "default-src 'self'".to_string(),
    );
    map.insert("x-frame-options".to_string(), "DENY".to_string());
    map.insert("x-content-type-options".to_string(), "nosniff".to_string());
    map.insert(
        "referrer-policy".to_string(),
        "strict-origin-when-cross-origin".to_string(),
    );
    map.insert(
        "permissions-policy".to_string(),
        "camera=(), microphone=()".to_string(),
    );

    let res = evaluate_security_headers(&map);
    assert_eq!(res.headers.score, 100);
    assert!(res.issues.is_empty());
}

#[test]
fn test_missing_all_security_headers() {
    let map = HashMap::new();
    let res = evaluate_security_headers(&map);

    assert!(res.headers.score < 50);
    assert!(res.issues.iter().any(|i| i.message.contains("HSTS")));
    assert!(res
        .issues
        .iter()
        .any(|i| i.message.contains("Content-Security-Policy")));
    assert!(res
        .issues
        .iter()
        .any(|i| i.message.contains("X-Frame-Options")));
}

#[test]
fn test_hsts_missing_max_age() {
    let mut map = HashMap::new();
    map.insert(
        "strict-transport-security".to_string(),
        "includeSubDomains".to_string(),
    );

    let res = evaluate_security_headers(&map);
    assert!(res
        .issues
        .iter()
        .any(|i| i.message.contains("missing 'max-age'")));
}

#[test]
fn test_csp_with_unsafe_inline() {
    let mut map = HashMap::new();
    map.insert(
        "content-security-policy".to_string(),
        "script-src 'self' 'unsafe-inline'".to_string(),
    );

    let res = evaluate_security_headers(&map);
    assert!(res
        .issues
        .iter()
        .any(|i| i.message.contains("unsafe-inline")));
}

#[test]
fn test_invalid_x_frame_options() {
    let mut map = HashMap::new();
    map.insert("x-frame-options".to_string(), "ALLOWALL".to_string());

    let res = evaluate_security_headers(&map);
    assert!(res
        .issues
        .iter()
        .any(|i| i.message.contains("non-standard")));
}
