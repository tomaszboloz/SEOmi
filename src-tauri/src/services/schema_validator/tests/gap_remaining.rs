use super::*;
use crate::services::schema_validator::{
    context::{context_contains_schema_org, JsonLdContext},
    issues::IssueCollector,
};
use serde_json::{json, Value};

#[test]
fn context_resets_after_depth_and_array_budget_limits() {
    let mut context = JsonLdContext::default();
    context.apply(&json!("https://schema.org"), 0);
    context.apply(&json!({"@vocab":"https://schema.org/"}), 65);
    assert!(context.expand("name", 0).is_none());

    let mut context = JsonLdContext::default();
    context.apply(&json!("https://schema.org"), 0);
    let values = vec![json!("https://schema.org"); 2_049];
    context.apply(&Value::Array(values), 0);
    assert!(context.expand("name", 0).is_none());
    assert!(!context_contains_schema_org(&json!({"@context": 17})));
}

#[test]
fn issue_collector_ignores_pushes_after_truncation() {
    let mut collector = IssueCollector::default();
    for _ in 0..500 {
        collector.push(crate::services::schema_validator::issues::issue(
            "test", "info", "message", None, None,
        ));
    }
    collector.push(crate::services::schema_validator::issues::issue(
        "ignored", "info", "message", None, None,
    ));
    assert!(collector.truncated);
    assert_eq!(collector.issues.len(), 500);
}

#[test]
fn jsonld_budget_and_context_variants_report_bounded_truthfully() {
    let values = (0..2_050).map(|_| Value::Null).collect::<Vec<_>>();
    let issues = validate_jsonld(&json!({"@context":"https://schema.org", "items":values}));
    assert!(issues
        .iter()
        .any(|issue| issue.code == "schema-validation-traversal-truncated"));
    let unknown = validate_jsonld(&json!({"@context":"https://other.example", "name":"x"}));
    assert!(!unknown
        .iter()
        .any(|issue| issue.code == "jsonld-node-type-missing"));
}

#[test]
fn microdata_and_product_shapes_reject_non_absolute_and_non_object_values() {
    let itemid = validate_microdata(&json!({
        "itemtype":"https://schema.org/Product",
        "itemid":"mailto:test@example.com"
    }));
    assert!(itemid
        .iter()
        .any(|issue| issue.code == "microdata-itemid-not-absolute"));
    let itemtype = validate_microdata(&json!({"itemtype":"/relative"}));
    assert!(itemtype
        .iter()
        .any(|issue| issue.code == "microdata-itemtype-not-absolute"));

    let issues = validate_jsonld(&json!({
        "@context":"https://schema.org",
        "@type":"Product",
        "offers":[],
        "review":[{}, null],
        "aggregateRating":"bad"
    }));
    assert_eq!(
        issues
            .iter()
            .filter(|issue| issue.code == "product-related-property-shape-invalid")
            .count(),
        3
    );
    let type_issues = validate_jsonld(&json!({
        "@context":"https://schema.org",
        "@type":["Product", null]
    }));
    assert!(type_issues
        .iter()
        .any(|issue| issue.code == "jsonld-type-item-invalid"));
    let empty_type = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@type": []
    }));
    assert!(empty_type
        .iter()
        .any(|issue| issue.code == "jsonld-type-empty"));
}
