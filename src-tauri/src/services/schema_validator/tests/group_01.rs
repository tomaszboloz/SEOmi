use super::*;
use serde_json::json;

#[test]
fn reports_jsonld_syntax_and_supported_product_profile_findings() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@type": "Product",
        "description": "A product without the supported rich result fields"
    }));
    assert!(issues
        .iter()
        .any(|item| item.code == "product-name-missing"));
    assert!(issues
        .iter()
        .any(|item| item.code == "product-offer-review-missing"));
    assert!(!issues.iter().any(|item| item.severity == "error"));
}

#[test]
fn validates_supported_profile_values_and_breadcrumb_item_structure() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@graph": [
            { "@type": "Product", "name": " ", "offers": null },
            { "@type": "BlogPosting", "headline": 42 },
            { "@type": "BreadcrumbList", "itemListElement": [
                { "@type": "ListItem", "position": 0, "name": " " },
                { "position": 2, "name": "Second" },
                "https://example.test/third"
            ] }
        ]
    }));

    for code in [
        "product-name-empty-or-invalid",
        "product-related-property-shape-invalid",
        "article-headline-empty-or-invalid",
        "breadcrumb-position-invalid",
        "breadcrumb-name-empty-or-invalid",
        "breadcrumb-list-item-type-missing",
        "breadcrumb-list-item-invalid",
    ] {
        assert!(
            issues.iter().any(|item| item.code == code),
            "expected {code}"
        );
    }
}

#[test]
fn accepts_well_shaped_values_in_the_supported_local_profiles() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "@graph": [
            { "@type": "Product", "name": "Example", "offers": { "@type": "Offer", "price": "10.00" } },
            { "@type": "Article", "headline": "Example article" },
            { "@type": "BreadcrumbList", "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.test/" }
            ] }
        ]
    }));

    assert!(!issues
        .iter()
        .any(|item| item.severity == "error" || item.severity == "warning"));
}

#[test]
fn validates_nested_graphs_and_type_shapes_without_rejecting_custom_types() {
    let issues = validate_jsonld(&json!({
        "@context": { "@vocab": "https://schema.org/" },
        "@graph": [
            { "@type": ["Article", "Article"], "headline": "Example" },
            { "@type": ["CustomType", 42] }
        ]
    }));
    assert!(issues
        .iter()
        .any(|item| item.code == "jsonld-type-duplicate"));
    assert!(issues
        .iter()
        .any(|item| item.code == "jsonld-type-item-invalid"));
    assert!(!issues.iter().any(|item| item.code == "schema-type-unknown"));
}

#[test]
fn detects_schema_org_context_declared_through_a_prefix_map() {
    let issues = validate_jsonld(&json!({
        "@context": {
            "schema": "https://schema.org/",
            "name": "schema:name"
        },
        "@type": "schema:Article",
        "headline": "Prefix context"
    }));

    assert!(!issues
        .iter()
        .any(|item| item.code == "jsonld-schema-context-not-detected"));
}

#[test]
fn bounds_deep_context_maps_before_schema_detection() {
    let mut context = json!("https://schema.org/");
    for _ in 0..(MAX_CONTEXT_DEPTH + 8) {
        context = json!({ "nested": context });
    }
    let issues = validate_jsonld(&json!({
        "@context": context,
        "@type": "Thing",
        "name": "bounded"
    }));

    assert!(issues
        .iter()
        .any(|item| item.code == "jsonld-schema-context-not-detected"));
}

#[test]
fn caps_large_jsonld_traversals_and_reports_the_partial_validation() {
    let value = Value::Array(
        (0..MAX_JSONLD_NODES + 100)
            .map(|index| {
                json!({
                    "@type": "Thing",
                    "name": format!("item-{index}"),
                })
            })
            .collect(),
    );

    let issues = validate_jsonld(&value);
    assert!(issues.len() <= MAX_VALIDATION_ISSUES);
    assert!(issues
        .iter()
        .any(|item| item.code == "schema-validation-traversal-truncated"));
}
