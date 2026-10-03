use super::*;

pub(super) fn validate(
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    validate_non_empty_string_if_present(
        value,
        path,
        "name",
        "person-name-empty-or-invalid",
        issues,
    );
    validate_non_empty_string_if_present(value, path, "url", "person-url-empty-or-invalid", issues);
}
