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
        "recipe-name-empty-or-invalid",
        issues,
    );
    validate_string_or_array_if_present(value, path, "image", "recipe-image-shape-invalid", issues);
    validate_object_or_string_if_present(
        value,
        path,
        "author",
        "recipe-author-shape-invalid",
        issues,
    );
    validate_string_if_present(value, path, "prepTime", "recipe-prep-time-invalid", issues);
    validate_string_if_present(value, path, "cookTime", "recipe-cook-time-invalid", issues);
    validate_string_if_present(
        value,
        path,
        "totalTime",
        "recipe-total-time-invalid",
        issues,
    );
}
