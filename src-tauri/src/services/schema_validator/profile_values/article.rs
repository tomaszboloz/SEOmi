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
    if value.contains_key("headline") && !non_empty_string_property(value, "headline") {
        issues.push(issue_at(
            "article-headline-empty-or-invalid",
            "Article headline is present but is not a non-empty string in the local profile."
                .into(),
            "headline",
        ));
    }
}
