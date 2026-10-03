use super::*;
use serde_json::json;

#[test]
fn caps_large_type_lists_and_reports_omitted_entries() {
    let value = json!({
        "@context": "https://schema.org",
        "@type": (0..MAX_JSONLD_TYPES_PER_NODE + 1)
            .map(|index| format!("Type{index}"))
            .collect::<Vec<_>>(),
    });

    let issues = validate_jsonld(&value);
    assert!(issues
        .iter()
        .any(|item| item.code == "jsonld-type-list-truncated"));
}

#[test]
fn caps_the_number_of_emitted_findings() {
    let invalid_types = vec![json!(42); MAX_JSONLD_TYPES_PER_NODE];
    let value = Value::Array(
        (0..MAX_JSONLD_NODES)
            .map(|_| json!({ "@type": invalid_types.clone() }))
            .collect(),
    );

    let issues = validate_jsonld(&value);
    assert_eq!(issues.len(), MAX_VALIDATION_ISSUES);
    assert!(issues
        .iter()
        .any(|item| item.code == "schema-validation-findings-truncated"));
}

#[test]
fn validates_microdata_and_rdfa_declaration_shapes() {
    let microdata = validate_microdata(&json!({ "itemtype": "Product", "itemprops": [] }));
    assert!(microdata
        .iter()
        .any(|item| item.code == "microdata-itemtype-not-absolute"));

    let rdfa = validate_rdfa(&json!({ "vocab": "not a URL", "typeof": 4 }));
    assert!(rdfa
        .iter()
        .any(|item| item.code == "rdfa-vocab-not-absolute"));
    assert!(rdfa
        .iter()
        .any(|item| item.code == "rdfa-term-shape-invalid"));
}

#[test]
fn validates_microdata_identifiers_references_and_duplicate_properties() {
    let issues = validate_microdata(&json!({
        "itemtype": "https://schema.org/Product",
        "itemid": "/relative-product",
        "itemref": ["details", "details", ""],
        "itemprops": ["name", "name", 7]
    }));
    for code in [
        "microdata-itemid-not-absolute",
        "microdata-itemref-duplicate",
        "microdata-itemref-invalid",
        "microdata-itemprop-duplicate",
        "microdata-itemprop-invalid",
    ] {
        assert!(
            issues.iter().any(|item| item.code == code),
            "expected {code}"
        );
    }
}

#[test]
fn validates_rdfa_relation_and_literal_attribute_shapes() {
    let issues = validate_rdfa(&json!({
        "vocab": "https://schema.org",
        "typeof": "",
        "property": "name",
        "rel": 4,
        "rev": "",
        "datatype": false,
        "content": "literal",
        "prefix": 8
    }));
    assert!(issues.iter().any(|item| item.code == "rdfa-term-empty"));
    assert!(issues
        .iter()
        .any(|item| item.code == "rdfa-term-shape-invalid"));
    assert!(issues
        .iter()
        .any(|item| item.path.as_deref() == Some("rel")));
}

#[test]
fn validates_common_organization_website_and_faq_profiles() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@graph": [
            { "@type": "Organization", "name": 7 },
            { "@type": "WebSite", "url": "https://example.test" },
            { "@type": "WebPage", "name": " " },
            { "@type": "LocalBusiness", "name": "Shop" },
            { "@type": "FAQPage", "mainEntity": [
                { "@type": "Question", "name": " ", "acceptedAnswer": "plain text" },
                { "name": "Second" }
            ] }
        ]
    }));
    for code in [
        "schema-name-empty-or-invalid",
        "schema-name-missing",
        "faq-question-name-empty-or-invalid",
        "faq-answer-shape-invalid",
        "faq-question-type-missing",
    ] {
        assert!(
            issues.iter().any(|item| item.code == code),
            "expected {code}"
        );
    }
}
