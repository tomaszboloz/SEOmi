use super::*;

pub(super) fn non_empty_string_property(
    value: &serde_json::Map<String, Value>,
    property: &str,
) -> bool {
    value
        .get(property)
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}
pub(super) fn validate_non_empty_string_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property) && !non_empty_string_property(value, property) {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} is present but is not a non-empty string in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Provide a non-empty value with the expected Schema.org shape."),
        ));
    }
}

pub(super) fn validate_string_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property) && value.get(property).and_then(Value::as_str).is_none() {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be a string in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use the expected string representation for this Schema.org property."),
        ));
    }
}

pub(super) fn validate_string_or_number_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property)
        && value.get(property).is_some_and(|property_value| {
            !property_value.is_string() && !property_value.is_number()
        })
    {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be a string or number in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use a numeric or string value with the expected Schema.org shape."),
        ));
    }
}

pub(super) fn validate_object_or_string_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property)
        && value.get(property).is_some_and(|property_value| {
            !property_value.is_object() && !property_value.is_string()
        })
    {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be an object or string in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use an embedded entity object or a string reference."),
        ));
    }
}

pub(super) fn validate_string_or_array_if_present(
    value: &serde_json::Map<String, Value>,
    path: &str,
    property: &str,
    code: &str,
    issues: &mut IssueCollector,
) {
    if value.contains_key(property)
        && value
            .get(property)
            .is_some_and(|property_value| !property_value.is_string() && !property_value.is_array())
    {
        issues.push(issue(
            code,
            "warning",
            format!("Schema property {property} must be a string or array in the local profile."),
            Some(format!("{path}.{property}")),
            Some("Use one URL string or an array of URL strings."),
        ));
    }
}
