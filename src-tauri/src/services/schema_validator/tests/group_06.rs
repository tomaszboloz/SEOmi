use super::*;
use serde_json::json;

#[test]
fn jsonld_generic_type_validation_remains_active_outside_schema() {
    let issues = validate_jsonld(
        &json!({"@context":"https://other.example/", "@type":["Product","Product",null], "name":""}),
    );
    assert!(issues
        .iter()
        .any(|item| item.code == "jsonld-type-item-invalid"));
    assert!(issues
        .iter()
        .any(|item| item.code == "jsonld-type-duplicate"));
    assert!(!issues.iter().any(|item| item.code.starts_with("product-")));
}
#[test]
fn jsonld_context_alias_cycles_and_oversized_maps_are_bounded() {
    for context in [
        json!({"Product":"Alias", "Alias":"Product", "@vocab":"https://schema.org/"}),
        json!({"s":null, "@vocab":"https://schema.org/"}),
        json!(false),
    ] {
        let issues = validate_jsonld(&json!({"@context":context, "@type":"s:Product"}));
        assert!(!issues.iter().any(|item| item.code.starts_with("product-")));
    }
    let issues = validate_jsonld(
        &json!({"@context":{"Product":"Alias", "Alias":"Product"},"@type":"Product"}),
    );
    assert!(!issues.iter().any(|item| item.code.starts_with("product-")));
    let oversized = (0..MAX_JSONLD_NODES + 1)
        .map(|index| (format!("term{index}"), json!("https://schema.org/")))
        .collect::<serde_json::Map<_, _>>();
    let issues =
        validate_jsonld(&json!({"@context":["https://schema.org", oversized],"@type":"Product"}));
    assert!(!issues.iter().any(|item| item.code.starts_with("product-")));
}

#[test]
fn jsonld_nested_schema_context_does_not_affect_external_parent_or_sibling() {
    let issues = validate_jsonld(&json!({
        "@context":"https://other.example/", "@type":"Product", "children":[
            {"@context":{"@vocab":"https://schema.org/"},"@type":"Product"},
            {"@type":"Product"}
        ]
    }));
    let paths = issues
        .iter()
        .filter(|item| item.code == "product-name-missing")
        .map(|item| item.path.as_deref().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(paths, vec!["$.children[0]"]);
}
