use super::ctx::{field, list_at, text_at};
use super::locate_evidence::{evidence_items, structured_items};
use super::strings::{loc as l, t};
use serde_json::Value;

const HEADERS: [(&str, &str, &str); 9] = [
    (
        "security_hsts",
        "Strict-Transport-Security",
        "strict_transport_security",
    ),
    (
        "security_csp_report",
        "Content-Security-Policy-Report-Only",
        "content_security_policy_report_only",
    ),
    (
        "security_csp",
        "Content-Security-Policy",
        "content_security_policy",
    ),
    ("security_xframe", "X-Frame-Options", "x_frame_options"),
    (
        "security_xcontent",
        "X-Content-Type-Options",
        "x_content_type_options",
    ),
    ("security_referrer", "Referrer-Policy", "referrer_policy"),
    (
        "security_permissions",
        "Permissions-Policy",
        "permissions_policy",
    ),
    (
        "security_coop",
        "Cross-Origin-Opener-Policy",
        "cross_origin_opener_policy",
    ),
    ("security_server", "Server", "server"),
];

fn header_items(audit: &Value, code: &str) -> Vec<String> {
    let (name, key) = HEADERS
        .iter()
        .find(|(prefix, _, _)| code.starts_with(prefix))
        .map(|(_, name, key)| (*name, *key))
        .unwrap_or(("X-Powered-By", "x_powered_by"));
    let mut items = vec![t(l::HEADER, &[name])];
    let value = text_at(audit, &format!("/security_headers/{key}"));
    items.push(match value {
        Some(value) => t(l::CURRENT, &[&value]),
        None => l::HEADER_MISSING.into(),
    });
    items
}

fn cookie_items(audit: &Value, code: &str) -> Vec<String> {
    let flag = if code.contains("secure") {
        "secure"
    } else {
        "http_only"
    };
    list_at(audit, "/transport_security/cookies")
        .iter()
        .filter(|cookie| match code {
            "cookie_samesite_missing" => field(cookie, "same_site").is_none(),
            _ => cookie.get(flag) != Some(&Value::Bool(true)),
        })
        .map(|cookie| t(l::COOKIE, &[&field(cookie, "name").unwrap_or_default()]))
        .collect()
}

pub fn tech_items(audit: &Value, code: &str, params: Option<&Value>) -> Vec<String> {
    if code.starts_with("security_") {
        header_items(audit, code)
    } else if code.starts_with("cookie_") {
        cookie_items(audit, code)
    } else if code == "transport_http" {
        vec![t(
            l::SCHEME,
            &[&text_at(audit, "/transport_security/scheme").unwrap_or_default()],
        )]
    } else if code == "transport_mixed_content" {
        list_at(audit, "/transport_security/mixed_content_urls")
            .iter()
            .filter_map(|url| url.as_str().map(|url| t(l::RESOURCE, &[url])))
            .collect()
    } else if code == "performance_response_slow" || code == "performance_http_status" {
        let ms = audit
            .get("response_time_ms")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let status = audit
            .get("http_status")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        vec![t(l::RESPONSE, &[&ms.to_string(), &status.to_string()])]
    } else if code == "performance_redirect_chain" {
        list_at(audit, "/redirect_chain")
            .iter()
            .map(|hop| {
                t(
                    l::HOP,
                    &[
                        &field(hop, "status_code").unwrap_or_default(),
                        &field(hop, "url").unwrap_or_default(),
                    ],
                )
            })
            .collect()
    } else if code == "structured_validation" {
        structured_items(audit, params)
    } else if code.starts_with("accessibility-") {
        evidence_items(audit, "/accessibility/findings", code)
    } else if let Some(amp_code) = code.strip_prefix("amp_") {
        evidence_items(audit, "/amp/findings", amp_code)
    } else {
        Vec::new()
    }
}
