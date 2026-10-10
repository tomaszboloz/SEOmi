use super::*;

pub(super) const GRAPH_RELATION_PROPERTIES: &[&str] = &[
    "author",
    "publisher",
    "mainEntityOfPage",
    "isPartOf",
    "about",
    "subjectOf",
];

const GRAPH_VALUE_PROPERTIES: &[&str] = &[
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

pub(super) fn collect_json_ld_references(
    value: &serde_json::Value,
    declaration_index: usize,
    references: &mut Vec<CrawledSchemaReference>,
    depth: usize,
) {
    walk_json_ld_references(value, declaration_index, references, depth, "$");
}

fn walk_json_ld_references(
    value: &serde_json::Value,
    declaration_index: usize,
    references: &mut Vec<CrawledSchemaReference>,
    depth: usize,
    path: &str,
) {
    if depth > 16 || references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
        return;
    }
    match value {
        serde_json::Value::Array(values) => {
            for (index, item) in values.iter().enumerate() {
                walk_json_ld_references(
                    item,
                    declaration_index,
                    references,
                    depth + 1,
                    &format!("{path}[{index}]"),
                );
            }
        }
        serde_json::Value::Object(map) => {
            push_node_values(map, "@id", declaration_index, references, path);
            push_node_values(map, "@type", declaration_index, references, path);
            push_node_values(map, "name", declaration_index, references, path);
            for (property, nested) in map {
                if GRAPH_VALUE_PROPERTIES.contains(&property.as_str()) {
                    push_relation_values(property, nested, declaration_index, references, path);
                }
                if property != "@context" {
                    walk_json_ld_references(
                        nested,
                        declaration_index,
                        references,
                        depth + 1,
                        &format!("{path}.{property}"),
                    );
                }
                if references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
                    break;
                }
            }
        }
        _ => {}
    }
}
