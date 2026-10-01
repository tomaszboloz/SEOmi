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
        "video-name-empty-or-invalid",
        issues,
    );
    validate_string_or_array_if_present(
        value,
        path,
        "thumbnailUrl",
        "video-thumbnail-shape-invalid",
        issues,
    );
    validate_non_empty_string_if_present(
        value,
        path,
        "uploadDate",
        "video-upload-date-empty-or-invalid",
        issues,
    );
    validate_non_empty_string_if_present(
        value,
        path,
        "contentUrl",
        "video-content-url-empty-or-invalid",
        issues,
    );
}
