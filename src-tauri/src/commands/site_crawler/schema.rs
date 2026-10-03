use super::*;

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

    inspect_microdata(
        document,
        &mut schema_types,
        &mut schema_references,
        &mut findings,
        &mut truncated,
    );
    inspect_rdfa(
        document,
        &mut schema_types,
        &mut schema_references,
        &mut findings,
        &mut truncated,
    );

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
