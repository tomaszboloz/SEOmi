use super::*;
use serde_json::json;

#[test]
fn missing_or_non_array_item_lists_emit_no_item_diagnostics() {
    for value in [json!({}), json!({"itemListElement": "not-a-list"})] {
        let mut issues = IssueCollector::default();
        validate(value.as_object().unwrap(), "$", &mut issues);
        assert!(issues.issues.is_empty());
    }
}
