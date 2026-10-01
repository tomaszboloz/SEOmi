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
    if let Some(Value::Array(items)) = value.get("itemListElement") {
        if items.is_empty() {
            issues.push(issue_at(
                "breadcrumb-items-empty",
                "BreadcrumbList itemListElement is present but empty in the local profile.".into(),
                "itemListElement",
            ));
        }
        for (index, item) in items.iter().take(MAX_JSONLD_NODES).enumerate() {
            let item_path = format!("{path}.itemListElement[{index}]");
            let Some(item_object) = item.as_object() else {
                issues.push(issue(
                    "breadcrumb-list-item-invalid",
                    "warning",
                    "BreadcrumbList entries should be ListItem objects in the local profile.",
                    Some(item_path),
                    Some("Use a ListItem with position, name, and the breadcrumb URL when available."),
                ));
                continue;
            };
            let item_type_valid = item_object
                .get("@type")
                .and_then(Value::as_str)
                .is_some_and(|item_type| type_name(item_type).eq_ignore_ascii_case("ListItem"));
            if !item_type_valid {
                issues.push(issue(
                    "breadcrumb-list-item-type-missing",
                    "warning",
                    "BreadcrumbList entry has no detectable ListItem @type in the local profile.",
                    Some(format!("{item_path}.@type")),
                    Some("Set @type to ListItem for each breadcrumb entry."),
                ));
            }
            let positive_position = item_object.get("position").is_some_and(|position| {
                position.as_u64().is_some_and(|position| position > 0)
                    || position
                        .as_str()
                        .and_then(|position| position.parse::<u64>().ok())
                        .is_some_and(|position| position > 0)
            });
            if !positive_position {
                issues.push(issue(
                    "breadcrumb-position-invalid",
                    "warning",
                    "Breadcrumb ListItem position must be a positive integer in the local profile.",
                    Some(format!("{item_path}.position")),
                    Some("Set a positive, ordered position value on each ListItem."),
                ));
            }
            if !non_empty_string_property(item_object, "name") {
                issues.push(issue(
                    "breadcrumb-name-empty-or-invalid",
                    "warning",
                    "Breadcrumb ListItem name must be a non-empty string in the local profile.",
                    Some(format!("{item_path}.name")),
                    Some("Add the visible breadcrumb label as a non-empty name."),
                ));
            }
        }
        if items.len() > MAX_JSONLD_NODES {
            issues.push(issue(
                "breadcrumb-list-truncated",
                "info",
                format!("BreadcrumbList validation was limited to {MAX_JSONLD_NODES} entries."),
                Some(format!("{path}.itemListElement")),
                Some("Review entries beyond the local validation limit in the source declaration."),
            ));
        }
    }
}
