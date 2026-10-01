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
        "event-name-empty-or-invalid",
        issues,
    );
    validate_non_empty_string_if_present(
        value,
        path,
        "startDate",
        "event-start-date-empty-or-invalid",
        issues,
    );
    validate_object_or_string_if_present(
        value,
        path,
        "location",
        "event-location-shape-invalid",
        issues,
    );
    validate_non_empty_string_if_present(
        value,
        path,
        "eventStatus",
        "event-status-empty-or-invalid",
        issues,
    );
}
