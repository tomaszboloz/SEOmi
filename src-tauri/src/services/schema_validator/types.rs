use super::*;

pub(super) fn type_name(value: &str) -> &str {
    value
        .trim_end_matches('/')
        .rsplit(['/', '#', ':'])
        .next()
        .unwrap_or(value)
}

pub(super) fn type_values(value: &Value, path: &str, issues: &mut IssueCollector) -> Vec<String> {
    match value {
        Value::String(value) if !value.trim().is_empty() => vec![value.trim().into()],
        Value::Array(values) => {
            let mut result = Vec::new();
            for (index, item) in values.iter().take(MAX_JSONLD_TYPES_PER_NODE).enumerate() {
                match item.as_str().map(str::trim).filter(|item| !item.is_empty()) {
                    Some(item) => result.push(item.to_string()),
                    None => issues.push(issue(
                        "jsonld-type-item-invalid",
                        "error",
                        "Every entry in @type must be a non-empty string.",
                        Some(format!("{path}[{index}]")),
                        Some("Use a Schema.org type name or an absolute type IRI."),
                    )),
                }
            }
            if result.is_empty() {
                issues.push(issue(
                    "jsonld-type-empty",
                    "error",
                    "@type is present but contains no usable type.",
                    Some(path.into()),
                    Some("Set @type to a string or a non-empty array of strings."),
                ));
            }
            if values.len() > MAX_JSONLD_TYPES_PER_NODE {
                issues.push(issue(
                    "jsonld-type-list-truncated",
                    "info",
                    format!("@type has more than {MAX_JSONLD_TYPES_PER_NODE} entries; remaining entries were not validated."),
                    Some(path.into()),
                    Some("Keep only applicable, distinct types in @type."),
                ));
            }
            result
        }
        _ => {
            issues.push(issue(
                "jsonld-type-invalid",
                "error",
                "@type must be a non-empty string or an array of strings.",
                Some(path.into()),
                Some("Use a Schema.org type name or an absolute type IRI."),
            ));
            Vec::new()
        }
    }
}
