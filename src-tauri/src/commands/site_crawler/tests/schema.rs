use super::*;

#[test]
fn discovers_json_ld_types_in_top_level_and_graph() {
    let value: serde_json::Value = serde_json::from_str(
        r#"{"@type":"WebSite","@graph":[{"@type":["Organization","Thing"]}]}"#,
    )
    .unwrap();
    let mut types = Vec::new();
    collect_json_ld_types(&value, &mut types);
    assert_eq!(types, vec!["WebSite", "Organization", "Thing"]);
}

#[test]
fn crawl_schema_inventory_includes_static_validation_findings_for_all_formats() {
    let document = Html::parse_document(
        r#"<html><head>
              <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":" ","offers":null}</script>
              <script type="application/ld+json">{invalid json}</script>
            </head><body>
              <div itemscope itemtype="Product"><span itemprop="name">Example</span></div>
              <div vocab="relative-vocab" typeof="Article" property="headline">Example</div>
            </body></html>"#,
    );

    let (types, syntax_errors, findings, references, truncated) = inspect_page_schema(&document);
    assert!(types.contains(&"Product".to_string()));
    assert!(types.contains(&"Article".to_string()));
    assert!(references.is_empty());
    assert_eq!(syntax_errors, 1);
    assert!(!truncated);
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "product-name-empty-or-invalid"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "product-related-property-shape-invalid"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "jsonld-syntax-invalid"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "microdata-itemtype-not-absolute"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "rdfa-vocab-not-absolute"));
    let serialized = serde_json::to_value(&findings[0]).expect("finding should serialize");
    assert!(serialized.get("finding").is_some());
}

#[test]
fn schema_inventory_retains_only_bounded_declared_identifiers_and_relations() {
    let document = Html::parse_document(
        r#"<html><head>
              <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"Organization","@id":"https://example.com/#org","url":"https://example.com/","sameAs":["https://social.example/acme",{"@id":"https://example.com/about"}],"publisher":{"@id":"https://example.com/#org"}}
              </script>
            </head><body>
              <div itemscope itemtype="https://schema.org/Article" itemid="https://example.com/article#item" itemref="author-node"></div>
              <div vocab="https://schema.org" typeof="Article"><a property="author" resource="https://example.com/author">Author</a></div>
            </body></html>"#,
    );

    let (_, _, _, references, truncated) = inspect_page_schema(&document);
    assert!(!truncated);
    assert!(references.iter().any(|reference| {
        reference.format == "JSON-LD"
            && reference.property == "@id"
            && reference.value == "https://example.com/#org"
    }));
    assert!(references.iter().any(|reference| {
        reference.format == "Microdata"
            && reference.property == "itemref"
            && reference.value == "author-node"
    }));
    assert!(references.iter().any(|reference| {
        reference.format == "RDFa"
            && reference.property == "author"
            && reference.value == "https://example.com/author"
    }));
    assert_eq!(
        references
            .iter()
            .filter(|reference| reference.property == "publisher")
            .count(),
        0,
        "nested objects without explicit @id/url must not become invented references"
    );
}
