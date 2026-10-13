use super::fixture::fixture;
use super::locate::where_items;
use serde_json::{json, Value};

fn at(code: &str) -> Vec<String> {
    where_items(&fixture(), code, None)
}

fn has(items: &[String], part: &str) -> bool {
    items.iter().any(|item| item.contains(part))
}

#[test]
fn header_codes_show_the_header_and_its_value() {
    let csp = at("security_csp_unsafe");
    assert!(has(&csp, "HTTP response header: Content-Security-Policy"));
    assert!(has(
        &csp,
        "Current value: default-src 'self' 'unsafe-inline'"
    ));
    assert!(has(
        &at("security_hsts_missing"),
        "Strict-Transport-Security"
    ));
    assert!(has(&at("security_hsts_missing"), "not sent by the server"));
    assert!(has(
        &at("security_csp_report_only"),
        "Content-Security-Policy-Report-Only"
    ));
    assert!(has(&at("security_powered_by"), "X-Powered-By"));
    assert!(has(&at("security_xframe_missing"), "Current value: DENY"));
    assert!(has(&at("indexability_xrobots_noindex"), "X-Robots-Tag"));
}

#[test]
fn transport_and_performance_codes_describe_the_evidence() {
    assert!(has(&at("transport_http"), "URL scheme: https"));
    let mixed = where_items(
        &json!({"final_url": "u", "transport_security": {"mixed_content_urls": ["http://x.test/a.js"]}}),
        "transport_mixed_content",
        None,
    );
    assert!(has(&mixed, "Insecure resource: http://x.test/a.js"));
    assert!(has(&at("performance_response_slow"), "HTTP 200 in 1200 ms"));
    assert!(has(
        &where_items(&json!({"final_url": "u"}), "performance_http_status", None),
        "HTTP 0 in 0 ms"
    ));
    assert!(has(
        &at("performance_redirect_chain"),
        "Redirect hop: HTTP 301 from http://example.test/"
    ));
}

#[test]
fn cookie_codes_list_only_cookies_missing_that_flag() {
    assert!(has(&at("cookie_secure_missing"), "Cookie: sid"));
    assert!(has(&at("cookie_samesite_missing"), "Cookie: sid"));
    assert_eq!(
        at("cookie_httponly_missing").len(),
        1,
        "sid already has HttpOnly"
    );
}

#[test]
fn structured_data_codes_point_at_the_json_path() {
    let params = json!({"detail": "Missing headline"});
    let items = where_items(&fixture(), "structured_validation", Some(&params));
    assert!(has(
        &items,
        "Structured data JSON-LD Article, path: $.headline"
    ));
    let other = json!({"detail": "Something else"});
    assert_eq!(
        where_items(&fixture(), "structured_validation", Some(&other)).len(),
        1
    );
    let nopath: Value = json!({"final_url": "u", "structured_data": [{"data_type": "T", "format": "F",
        "validation_issues": [{"message": "m"}]}]});
    assert!(has(
        &where_items(&nopath, "structured_validation", None),
        "path: not specified"
    ));
}

#[test]
fn accessibility_and_amp_codes_use_selectors_lines_and_evidence() {
    let items = at("accessibility-x");
    assert!(has(
        &items,
        "main > button (line 4, column 2): <button></button>"
    ));
    let amp = json!({"final_url": "u", "amp": {"findings": [{"code": "amp-img", "evidence": "<img>"}]},
        "accessibility": {"findings": [{"code": "accessibility-y", "evidence": "No lang", "elements": [
            {"dom_query": "html", "html_snippet": "<html>"}]}]}});
    assert!(has(
        &where_items(&amp, "amp_amp-img", None),
        "Evidence: <img>"
    ));
    assert!(has(
        &where_items(&amp, "accessibility-y", None),
        "html: <html>"
    ));
    assert!(!has(&where_items(&amp, "accessibility-y", None), "line"));
}
