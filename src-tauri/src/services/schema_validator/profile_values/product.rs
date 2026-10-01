use super::*;

pub(super) fn validate(
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    let issue_at = |code: &str, message: String, property: &str| {
        issue(
            code,
            "warning",
            message,
            Some(format!("{path}.{property}")),
            Some("Check the property value and its expected Schema.org shape in the source declaration."),
        )
    };
    if value.contains_key("name") && !non_empty_string_property(value, "name") {
        issues.push(issue_at(
            "product-name-empty-or-invalid",
            "Product name is present but is not a non-empty string in the local profile.".into(),
            "name",
        ));
    }
    for property in ["offers", "review", "aggregateRating"] {
        if let Some(field) = value.get(property) {
            let has_supported_shape = match field {
                Value::Object(_) => true,
                Value::Array(items) => !items.is_empty() && items.iter().all(Value::is_object),
                _ => false,
            };
            if !has_supported_shape {
                issues.push(issue_at(
                    "product-related-property-shape-invalid",
                    format!("Product {property} must be a non-empty object or an array of objects in the local profile."),
                    property,
                ));
            }
        }
    }
}
