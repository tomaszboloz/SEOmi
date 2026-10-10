use super::*;

pub(super) fn push_node_values(
    object: &serde_json::Map<String, serde_json::Value>,
    property: &str,
    declaration_index: usize,
    references: &mut Vec<CrawledSchemaReference>,
    path: &str,
) {
    let Some(value) = object.get(property) else {
        return;
    };
    match value {
        serde_json::Value::String(value) => {
            push_graph_reference(references, declaration_index, property, value, path)
        }
        serde_json::Value::Array(values) => values
            .iter()
            .filter_map(|item| item.as_str())
            .for_each(|value| {
                push_graph_reference(references, declaration_index, property, value, path)
            }),
        _ => {}
    }
}

pub(super) fn push_relation_values(
    property: &str,
    value: &serde_json::Value,
    declaration_index: usize,
    references: &mut Vec<CrawledSchemaReference>,
    path: &str,
) {
    let mut values = Vec::new();
    match value {
        serde_json::Value::String(value) => values.push(value.as_str()),
        serde_json::Value::Array(items) => items.iter().for_each(|item| match item {
            serde_json::Value::String(value) => values.push(value.as_str()),
            serde_json::Value::Object(object) => object
                .get("@id")
                .and_then(serde_json::Value::as_str)
                .into_iter()
                .for_each(|value| values.push(value)),
            _ => {}
        }),
        serde_json::Value::Object(object) => object
            .get("@id")
            .and_then(serde_json::Value::as_str)
            .into_iter()
            .for_each(|value| values.push(value)),
        _ => {}
    }
    for value in values {
        push_graph_reference(references, declaration_index, property, value, path);
    }
}

fn push_graph_reference(
    references: &mut Vec<CrawledSchemaReference>,
    declaration_index: usize,
    property: &str,
    value: &str,
    path: &str,
) {
    if references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
        return;
    }
    let property = property.trim();
    let value = value.trim();
    if property.is_empty()
        || value.is_empty()
        || value.chars().count() > MAX_SCHEMA_REFERENCE_VALUE_CHARS
        || value.chars().any(char::is_control)
    {
        return;
    }
    let candidate = CrawledSchemaReference {
        format: "JSON-LD".into(),
        declaration_index,
        property: property.into(),
        value: value.into(),
        node_path: Some(path.into()),
    };
    if !references.iter().any(|reference| reference == &candidate) {
        references.push(candidate);
    }
}
