use super::super::models::SiteCrawlResult;
use serde_json::{json, Value};

fn result_payload() -> Value {
    json!({
        "start_url": "https://example.test",
        "pages_crawled": 0, "health_score": 100,
        "critical_count": 0, "warning_count": 0, "notice_count": 0,
        "pages": [], "duration_ms": 12, "cancelled": false, "timed_out": false,
        "robots_txt_status": "not_checked", "robots_blocked_count": 0,
        "sitemap_status": "not_checked", "sitemap_urls_discovered": 0,
        "sitemap_urls": [], "rejected_urls": [], "resources": [],
        "resource_limit_reached": false
    })
}

#[test]
fn site_result_wire_defaults_legacy_fields_and_drops_unknown_fields() {
    let mut value = result_payload();
    value["futureResultField"] = json!({"version": 2});
    let result: SiteCrawlResult = serde_json::from_value(value).unwrap();
    assert_eq!(result.crawl_mode, "http");
    assert!(result.robots_user_agent.is_empty());
    assert!(result.robots_applicable_rules.is_empty());
    assert!(!result.discovery_provenance_truncated);
    assert!(result.limit_reasons.is_empty());
    assert!(!serde_json::to_value(result)
        .unwrap()
        .as_object()
        .unwrap()
        .contains_key("futureResultField"));
}

#[test]
fn site_result_wire_rejects_missing_wrong_type_and_invalid_sequence() {
    let mut missing = result_payload();
    missing.as_object_mut().unwrap().remove("start_url");
    assert!(serde_json::from_value::<SiteCrawlResult>(missing).is_err());
    let mut wrong = result_payload();
    wrong["health_score"] = json!("perfect");
    assert!(serde_json::from_value::<SiteCrawlResult>(wrong).is_err());
    assert!(serde_json::from_value::<SiteCrawlResult>(json!([])).is_err());
}

#[test]
fn site_result_wire_rejects_duplicate_keys() {
    let raw = serde_json::to_string(&result_payload()).unwrap();
    let duplicate = raw.replacen("{", r#"{"start_url":"https://first.example","#, 1);
    let error = serde_json::from_str::<SiteCrawlResult>(&duplicate).unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("start_url"));
}
