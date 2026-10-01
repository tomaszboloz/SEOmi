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

pub(super) fn inspect_page_schema(
    document: &Html,
) -> (
    Vec<String>,
    usize,
    Vec<CrawledSchemaFinding>,
    Vec<CrawledSchemaReference>,
    bool,
) {
    let json_ld_selector = Selector::parse("script[type='application/ld+json']").unwrap();
    let microdata_selector = Selector::parse("[itemscope]").unwrap();
    let itemprop_selector = Selector::parse("[itemprop]").unwrap();
    let rdfa_selector = Selector::parse(
        "[typeof], [property], [vocab], [about], [resource], [property][href], [property][src], [rel][resource]",
    )
    .unwrap();
    let mut schema_types = Vec::new();
    let mut schema_references = Vec::new();
    let mut syntax_errors = 0;
    let mut findings = Vec::new();
    let mut truncated = false;

    let jsonld_blocks = document.select(&json_ld_selector).collect::<Vec<_>>();
    for (index, element) in jsonld_blocks
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let raw = element.text().collect::<String>();
        match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(value) => {
                collect_json_ld_types(&value, &mut schema_types);
                collect_json_ld_references(&value, index + 1, &mut schema_references, 0);
                append_schema_findings(
                    schema_validator::validate_jsonld(&value),
                    "JSON-LD",
                    index + 1,
                    &mut findings,
                    &mut truncated,
                );
            }
            Err(error) => {
                syntax_errors += 1;
                append_schema_findings(
                    vec![StructuredDataValidationIssue {
                        code: "jsonld-syntax-invalid".into(),
                        severity: "error".into(),
                        message: format!("JSON-LD could not be parsed: {error}"),
                        path: None,
                        recommendation: Some(
                            "Fix the JSON syntax in this script[type=application/ld+json] block."
                                .into(),
                        ),
                    }],
                    "JSON-LD",
                    index + 1,
                    &mut findings,
                    &mut truncated,
                );
            }
        }
    }
    if jsonld_blocks.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        truncated = true;
    }

    let microdata_items = document.select(&microdata_selector).collect::<Vec<_>>();
    for (index, element) in microdata_items
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let itemprops = element
            .select(&itemprop_selector)
            .flat_map(|property| {
                property
                    .value()
                    .attr("itemprop")
                    .unwrap_or_default()
                    .split_ascii_whitespace()
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        let itemtype = element.value().attr("itemtype").map(str::trim);
        if let Some(itemtype) = itemtype {
            schema_types.extend(itemtype.split_ascii_whitespace().map(str::to_owned));
        }
        if let Some(itemid) = element.value().attr("itemid") {
            push_schema_reference(
                &mut schema_references,
                "Microdata",
                index + 1,
                "itemid",
                itemid,
            );
        }
        if let Some(itemref) = element.value().attr("itemref") {
            for target in itemref.split_ascii_whitespace() {
                push_schema_reference(
                    &mut schema_references,
                    "Microdata",
                    index + 1,
                    "itemref",
                    target,
                );
            }
        }
        let value = serde_json::json!({ "itemtype": itemtype, "itemprops": itemprops });
        append_schema_findings(
            schema_validator::validate_microdata(&value),
            "Microdata",
            index + 1,
            &mut findings,
            &mut truncated,
        );
    }
    if microdata_items.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        truncated = true;
    }

    let rdfa_nodes = document.select(&rdfa_selector).collect::<Vec<_>>();
    for (index, element) in rdfa_nodes
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let typeof_value = element.value().attr("typeof").map(str::trim);
        if let Some(typeof_value) = typeof_value {
            schema_types.extend(typeof_value.split_ascii_whitespace().map(str::to_owned));
        }
        let value = serde_json::json!({
            "typeof": typeof_value,
            "property": element.value().attr("property").map(str::trim),
            "vocab": element.value().attr("vocab").map(str::trim),
            "about": element.value().attr("about"),
            "resource": element.value().attr("resource"),
        });
        let relation_property = element
            .value()
            .attr("property")
            .or_else(|| element.value().attr("rel"))
            .unwrap_or("@resource");
        for attribute in ["resource", "href", "src", "about"] {
            if let Some(target) = element.value().attr(attribute) {
                push_schema_reference(
                    &mut schema_references,
                    "RDFa",
                    index + 1,
                    relation_property,
                    target,
                );
            }
        }
        append_schema_findings(
            schema_validator::validate_rdfa(&value),
            "RDFa",
            index + 1,
            &mut findings,
            &mut truncated,
        );
    }
    if rdfa_nodes.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        truncated = true;
    }

    schema_types.sort();
    schema_types.dedup();
    if truncated && findings.len() < MAX_SCHEMA_FINDINGS_PER_PAGE {
        findings.push(CrawledSchemaFinding {
            format: "Local validation".into(),
            declaration_index: 0,
            finding: StructuredDataValidationIssue {
                code: "schema-validation-truncated".into(),
                severity: "info".into(),
                message: "Structured-data validation was capped by per-page safety limits.".into(),
                path: None,
                recommendation: Some(
                    "Review declarations omitted after the local safety limit in the source page."
                        .into(),
                ),
            },
        });
    }
    schema_references.sort_by(|left, right| {
        left.format
            .cmp(&right.format)
            .then(left.declaration_index.cmp(&right.declaration_index))
            .then(left.property.cmp(&right.property))
            .then(left.value.cmp(&right.value))
    });
    (
        schema_types,
        syntax_errors,
        findings,
        schema_references,
        truncated,
    )
}
