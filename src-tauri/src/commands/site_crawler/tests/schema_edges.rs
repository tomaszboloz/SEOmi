use super::*;

#[test]
fn schema_inspection_marks_json_ld_microdata_and_rdfa_declaration_caps() {
    let json_ld = (0..=MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .map(|_| {
            "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Thing\"}</script>"
        })
        .collect::<String>();
    let microdata = (0..=MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .map(|_| "<div itemscope itemtype=\"https://schema.org/Thing\"></div>")
        .collect::<String>();
    let rdfa = (0..=MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .map(|_| "<div vocab=\"https://schema.org\" typeof=\"Thing\" property=\"name\">x</div>")
        .collect::<String>();
    let document = Html::parse_document(&format!(
        "<head>{json_ld}</head><body><div itemscope></div>{microdata}{rdfa}</body>"
    ));

    let (types, syntax_errors, findings, references, truncated) = inspect_page_schema(&document);

    assert!(types.contains(&"Thing".to_string()));
    assert_eq!(syntax_errors, 0);
    assert!(references
        .iter()
        .all(|reference| ["@type", "name"].contains(&reference.property.as_str())));
    assert!(truncated);
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "microdata-itemtype-missing"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "schema-validation-truncated"));
}

#[test]
fn rdfa_inventory_keeps_each_declared_target_attribute_and_relation_name() {
    let document = Html::parse_document(
        r#"<div vocab="https://schema.org" typeof="Thing">
            <a property="link" href="/href">href</a>
            <img property="image" src="/src">
            <span about="/about">about</span>
            <link rel="alternate" resource="/resource">
        </div>"#,
    );
    let (_, _, _, references, _) = inspect_page_schema(&document);

    for (property, value) in [
        ("link", "/href"),
        ("image", "/src"),
        ("@resource", "/about"),
        ("alternate", "/resource"),
    ] {
        assert!(references
            .iter()
            .any(|item| item.format == "RDFa" && item.property == property && item.value == value));
    }

    let mut types = Vec::new();
    collect_json_ld_types(&serde_json::json!({"@type": true}), &mut types);
    assert!(types.is_empty());
}
