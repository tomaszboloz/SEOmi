use super::*;
use serde_json::json;

#[test]
fn whitespace_only_string_type_is_reported_as_invalid() {
    let mut issues = IssueCollector::default();
    let types = type_values(&json!("   "), "$.@type", &mut issues);
    assert!(types.is_empty());
    let found = issues.finish(false);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].code, "jsonld-type-invalid");
    assert_eq!(found[0].path.as_deref(), Some("$.@type"));
}

#[test]
fn trimmed_string_type_is_returned_without_issues() {
    let mut issues = IssueCollector::default();
    let types = type_values(&json!(" Product "), "$.@type", &mut issues);
    assert_eq!(types, vec!["Product".to_string()]);
    assert!(issues.finish(false).is_empty());
}
