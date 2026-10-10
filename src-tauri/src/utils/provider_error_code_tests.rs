use super::known_reason;
use serde_json::json;

fn code(body: serde_json::Value) -> Option<&'static str> {
    known_reason(&body).map(|(code, _)| code)
}

#[test]
fn oauth_token_errors_map_to_fixed_codes_and_hints() {
    let (reason, hint) = known_reason(&json!({
        "error": "invalid_request",
        "error_description": "client_secret is missing."
    }))
    .unwrap();
    assert_eq!(reason, "invalid_request");
    assert!(hint.contains("client secret"));
    assert!(!hint.contains("client_secret is missing"));
    for known in ["invalid_client", "invalid_grant", "redirect_uri_mismatch"] {
        assert_eq!(code(json!({ "error": known })), Some(known));
    }
}

#[test]
fn google_api_errors_prefer_the_specific_reason_over_the_status() {
    let disabled = json!({"error": {
        "code": 403,
        "message": "Search Console API has not been used in project 123 before or it is disabled.",
        "status": "PERMISSION_DENIED",
        "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "SERVICE_DISABLED"}]
    }});
    assert_eq!(code(disabled), Some("SERVICE_DISABLED"));
    let legacy = json!({"error": {"code": 403, "errors": [{"reason": "accessNotConfigured"}]}});
    assert_eq!(code(legacy), Some("accessNotConfigured"));
    let status_only = json!({"error": {"code": 403, "status": "PERMISSION_DENIED"}});
    assert_eq!(code(status_only), Some("PERMISSION_DENIED"));
}

#[test]
fn unknown_or_malformed_reasons_are_never_passed_through() {
    for body in [
        json!({}),
        json!({"error": "private provider text"}),
        json!({"error": {"message": "invalid_client"}}),
        json!({"error": {"status": 403, "details": "SERVICE_DISABLED"}}),
        json!({"error": {"details": [{"reason": 7}, "SERVICE_DISABLED"]}}),
        json!({"error_description": "invalid_client"}),
    ] {
        assert_eq!(known_reason(&body), None, "{body}");
    }
}
