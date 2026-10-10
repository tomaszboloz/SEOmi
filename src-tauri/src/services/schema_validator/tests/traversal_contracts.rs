use super::*;
use serde_json::json;

#[test]
fn scalar_documents_report_only_unobserved_schema_context() {
    for document in [Value::Null, json!(true), json!(17), json!("schema.org")] {
        let issues = validate_jsonld(&document);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, "jsonld-schema-context-not-detected");
        assert_eq!(issues[0].severity, "info");
        assert_eq!(issues[0].path.as_deref(), Some("$.@context"));
    }
}

#[test]
fn depth_limit_reports_partial_validation_without_examining_hidden_profiles() {
    let mut document = json!({"@type": "Product"});
    for _ in 0..=MAX_JSONLD_DEPTH {
        document = json!([document]);
    }
    let document = json!({"@context": "https://schema.org", "@graph": document});
    let issues = validate_jsonld(&document);
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code, "schema-validation-traversal-truncated");
    assert_eq!(issues[0].severity, "info");
    assert_eq!(issues[0].path, None);
    assert!(issues[0]
        .recommendation
        .as_deref()
        .unwrap()
        .contains("not all nested data was validated"));
}
