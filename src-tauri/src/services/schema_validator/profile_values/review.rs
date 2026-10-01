use super::*;

pub(super) fn validate(
    value: &serde_json::Map<String, Value>,
    path: &str,
    issues: &mut IssueCollector,
) {
    validate_non_empty_string_if_present(
        value,
        path,
        "reviewBody",
        "review-body-empty-or-invalid",
        issues,
    );
    validate_object_or_string_if_present(
        value,
        path,
        "author",
        "review-author-shape-invalid",
        issues,
    );
    validate_object_or_string_if_present(
        value,
        path,
        "reviewRating",
        "review-rating-shape-invalid",
        issues,
    );
}
