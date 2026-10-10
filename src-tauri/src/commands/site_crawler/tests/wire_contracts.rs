use super::super::models::{
    CrawlConfig, CrawledIndexabilityVerdict, CrawledPageSummary, CrawledRobotsDecision,
};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

fn reject<T: DeserializeOwned>(value: Value) {
    assert!(serde_json::from_value::<T>(value).is_err());
}

fn page_payload() -> Value {
    json!({
        "url": "https://example.test/page",
        "final_url": "https://example.test/page",
        "redirect_chain": [], "depth": 0, "http_status": 200,
        "response_time_ms": 10, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 12, "schema_types": [],
        "schema_syntax_errors": 0, "document_language": null, "hreflangs": [],
        "h1_count": 1, "heading_counts": [1, 0, 0, 0, 0, 0],
        "pagination_next": null, "pagination_prev": null,
        "internal_link_count": 0, "external_link_count": 0,
        "links": [], "images": [], "issues_count": 0, "issues": []
    })
}

#[test]
fn page_wire_defaults_unknown_fields_and_rejects_duplicate_keys() {
    let mut value = page_payload();
    value["futureSignal"] = json!(true);
    let page: CrawledPageSummary = serde_json::from_value(value).unwrap();
    assert!(page.discovery_sources.is_empty());
    assert_eq!(page.semantic_content_source, "unavailable");
    assert!(!serde_json::to_value(page)
        .unwrap()
        .as_object()
        .unwrap()
        .contains_key("futureSignal"));

    let raw = serde_json::to_string(&page_payload()).unwrap();
    let duplicate = raw.replacen("{", r#"{"url":"https://first.example","#, 1);
    let error = serde_json::from_str::<CrawledPageSummary>(&duplicate).unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("url"));
}

#[test]
fn page_wire_rejects_missing_required_wrong_type_and_invalid_sequence() {
    let mut missing = page_payload();
    missing.as_object_mut().unwrap().remove("url");
    reject::<CrawledPageSummary>(missing);
    let mut wrong = page_payload();
    wrong["depth"] = json!("zero");
    reject::<CrawledPageSummary>(wrong);
    reject::<CrawledPageSummary>(json!(["https://example.test/page"]));
}

#[test]
fn crawl_config_wire_uses_camel_case_defaults_and_ignores_unknown_fields() {
    let value = json!({"maxPages": 7, "futureOption": "ignored"});
    let config: CrawlConfig = serde_json::from_value(value).unwrap();
    assert_eq!(config.max_pages, Some(7));
    assert_eq!(config.crawl_mode, "http");
    assert!(config.respect_robots && config.respect_crawl_delay && config.verify_ssl);
    let wire = serde_json::to_value(config).unwrap();
    assert!(wire.get("maxPages").is_some());
    assert!(wire.get("max_pages").is_none() && wire.get("futureOption").is_none());
}

#[test]
fn crawl_config_wire_rejects_wrong_types_and_duplicate_keys() {
    reject::<CrawlConfig>(json!({"maxPages": "seven"}));
    reject::<CrawlConfig>(json!([true]));
    let sequence: CrawlConfig = serde_json::from_str(
        r#"["browser-rendered",null,null,null,null,null,[],[],false,[],null,false,true,true,true,null,false,null,null,null,true,[],false,null,null,false,false,false,[],[],[],null,false,false,false,false,null,null,[],[]]"#,
    )
    .unwrap();
    assert_eq!(sequence.crawl_mode, "browser-rendered");
    let error = serde_json::from_str::<CrawlConfig>(r#"{"maxPages":1,"maxPages":2}"#).unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("maxPages"));
}

#[test]
fn robots_decision_and_verdict_cover_defaults_errors_and_sequences() {
    let decision: CrawledRobotsDecision = serde_json::from_value(json!({
        "indexability": "index", "link_following": "follow",
        "response_headers_available": true, "future": 1
    }))
    .unwrap();
    assert!(decision.directives.is_empty() && decision.sources.is_empty());
    reject::<CrawledRobotsDecision>(json!({"indexability": "index"}));
    reject::<CrawledRobotsDecision>(json!({
        "indexability": [], "link_following": "follow", "response_headers_available": true
    }));
    let sequence: CrawledRobotsDecision = serde_json::from_value(json!([
        "noindex",
        "nofollow",
        ["noindex"],
        ["meta robots"],
        false
    ]))
    .unwrap();
    assert_eq!(sequence.indexability, "noindex");
    reject::<CrawledRobotsDecision>(json!(["index"]));
    let error = serde_json::from_str::<CrawledRobotsDecision>(
        r#"{"indexability":"first","indexability":"last","link_following":"follow","response_headers_available":true}"#,
    )
    .unwrap_err();
    assert!(error.to_string().contains("duplicate field"));
    assert!(error.to_string().contains("indexability"));

    let verdict: CrawledIndexabilityVerdict =
        serde_json::from_value(json!(["uncertain", ["canonical"]])).unwrap();
    assert_eq!(verdict.reasons, vec!["canonical"]);
    let defaulted: CrawledIndexabilityVerdict =
        serde_json::from_value(json!({"status": "indexable"})).unwrap();
    assert!(defaulted.reasons.is_empty());
    reject::<CrawledIndexabilityVerdict>(json!({}));
    reject::<CrawledIndexabilityVerdict>(json!({"status": 200}));
}
