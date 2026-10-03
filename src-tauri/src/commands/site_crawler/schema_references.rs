use super::*;

pub(super) fn collect_json_ld_types(value: &serde_json::Value, types: &mut Vec<String>) {
    match value {
        serde_json::Value::Array(items) => items
            .iter()
            .for_each(|item| collect_json_ld_types(item, types)),
        serde_json::Value::Object(map) => {
            if let Some(value) = map.get("@type") {
                match value {
                    serde_json::Value::String(value) => types.push(value.to_string()),
                    serde_json::Value::Array(values) => values
                        .iter()
                        .filter_map(|value| value.as_str())
                        .for_each(|value| types.push(value.to_string())),
                    _ => {}
                }
            }
            if let Some(graph) = map.get("@graph") {
                collect_json_ld_types(graph, types);
            }
        }
        _ => {}
    }
}

pub(super) fn append_schema_findings(
    findings: Vec<StructuredDataValidationIssue>,
    format: &str,
    declaration_index: usize,
    output: &mut Vec<CrawledSchemaFinding>,
    truncated: &mut bool,
) {
    for finding in findings {
        if output.len() >= MAX_SCHEMA_FINDINGS_PER_PAGE {
            *truncated = true;
            break;
        }
        output.push(CrawledSchemaFinding {
            format: format.to_string(),
            declaration_index,
            finding,
        });
    }
}

pub(super) fn push_schema_reference(
    references: &mut Vec<CrawledSchemaReference>,
    format: &str,
    declaration_index: usize,
    property: &str,
    value: &str,
) {
    if references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
        return;
    }
    let property = property.trim();
    let value = value.trim();
    if property.is_empty()
        || value.is_empty()
        || value.chars().count() > MAX_SCHEMA_REFERENCE_VALUE_CHARS
    {
        return;
    }
    if value.chars().any(char::is_control) {
        return;
    }
    let candidate = CrawledSchemaReference {
        format: format.to_string(),
        declaration_index,
        property: property.to_string(),
        value: value.to_string(),
    };
    if !references.iter().any(|reference| reference == &candidate) {
        references.push(candidate);
    }
}

pub(super) fn collect_json_ld_references(
    value: &serde_json::Value,
    declaration_index: usize,
    references: &mut Vec<CrawledSchemaReference>,
    depth: usize,
) {
    if depth > 16 || references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
        return;
    }
    const REFERENCE_PROPERTIES: &[&str] = &[
        "@id",
        "url",
        "sameAs",
        "mainEntityOfPage",
        "isPartOf",
        "about",
        "subjectOf",
        "author",
        "publisher",
        "image",
        "logo",
    ];
    match value {
        serde_json::Value::Array(values) => values.iter().for_each(|item| {
            collect_json_ld_references(item, declaration_index, references, depth + 1)
        }),
        serde_json::Value::Object(map) => {
            for (property, nested) in map {
                if REFERENCE_PROPERTIES.contains(&property.as_str()) {
                    match nested {
                        serde_json::Value::String(value) => push_schema_reference(
                            references,
                            "JSON-LD",
                            declaration_index,
                            property,
                            value,
                        ),
                        serde_json::Value::Array(values) => values.iter().for_each(|item| {
                            if let serde_json::Value::String(value) = item {
                                push_schema_reference(
                                    references,
                                    "JSON-LD",
                                    declaration_index,
                                    property,
                                    value,
                                );
                            }
                        }),
                        _ => {}
                    }
                }
                collect_json_ld_references(nested, declaration_index, references, depth + 1);
                if references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
                    break;
                }
            }
        }
        _ => {}
    }
}
