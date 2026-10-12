use super::super::{
    issues::IssueCollector,
    property_shapes::{
        validate_object_or_string_if_present, validate_string_or_array_if_present,
        validate_string_or_number_if_present,
    },
};
use serde_json::{json, Map, Value};

#[test]
fn optional_shape_helpers_ignore_absent_properties_and_accept_supported_values() {
    let empty = Map::new();
    for (property, accepted) in [
        ("price", json!("12.00")),
        ("price", json!(12.0)),
        ("offers", json!({"@type": "Offer"})),
        ("offers", json!("https://example.test/offer")),
        ("item", json!("https://example.test/item")),
        ("item", json!(["https://example.test/item"])),
    ] {
        let mut value = empty.clone();
        value.insert(property.into(), accepted);
        let mut issues = IssueCollector::default();
        validate_string_or_number_if_present(&value, "$", "price", "price-shape", &mut issues);
        validate_object_or_string_if_present(&value, "$", "offers", "offers-shape", &mut issues);
        validate_string_or_array_if_present(&value, "$", "item", "item-shape", &mut issues);
        assert!(issues.finish(false).is_empty(), "{property}");
    }

    let mut issues = IssueCollector::default();
    validate_string_or_number_if_present(&empty, "$", "price", "price-shape", &mut issues);
    validate_object_or_string_if_present(&empty, "$", "offers", "offers-shape", &mut issues);
    validate_string_or_array_if_present(&empty, "$", "item", "item-shape", &mut issues);
    assert!(issues.finish(false).is_empty());
}

#[test]
fn optional_shape_helpers_report_each_unsupported_value() {
    let mut value = Map::new();
    value.insert("price".into(), Value::Bool(true));
    value.insert("offers".into(), Value::Array(Vec::new()));
    value.insert("item".into(), Value::Number(serde_json::Number::from(1)));
    let mut issues = IssueCollector::default();
    validate_string_or_number_if_present(&value, "$", "price", "price-shape", &mut issues);
    validate_object_or_string_if_present(&value, "$", "offers", "offers-shape", &mut issues);
    validate_string_or_array_if_present(&value, "$", "item", "item-shape", &mut issues);
    let issues = issues.finish(false);
    assert_eq!(issues.len(), 3);
    assert!(issues.iter().all(|issue| issue.severity == "warning"));
}
