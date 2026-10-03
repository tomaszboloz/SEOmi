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
            "schema-name-empty-or-invalid",
            "The profile name is present but is not a non-empty string in the local ruleset."
                .into(),
            "name",
        ));
    }
}
