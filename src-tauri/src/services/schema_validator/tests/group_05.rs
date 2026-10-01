use super::*;
use serde_json::json;

#[test]
fn jsonld_present_empty_profile_values_are_reported_separately_from_missing_properties() {
    for (kind, property, code) in [
        ("Product", "name", "product-name-empty-or-invalid"),
        ("Article", "headline", "article-headline-empty-or-invalid"),
        ("Organization", "name", "schema-name-empty-or-invalid"),
    ] {
        let mut document = serde_json::json!({"@context":"https://schema.org","@type":kind});
        document[property] = serde_json::json!(" ");
        assert!(validate_jsonld(&document)
            .iter()
            .any(|issue| issue.code == code));
        document[property] = serde_json::json!("Visible value");
        assert!(!validate_jsonld(&document)
            .iter()
            .any(|issue| issue.code == code));
    }
    let invalid_product = validate_jsonld(
        &serde_json::json!({"@context":"https://schema.org","@type":"Product","name":"Product","offers":[],"review":"text","aggregateRating":false}),
    );
    assert_eq!(
        invalid_product
            .iter()
            .filter(|issue| issue.code == "product-related-property-shape-invalid")
            .count(),
        3
    );
}

#[test]
fn faq_profile_distinguishes_malformed_entries_and_missing_main_entity() {
    for main_entity in [
        serde_json::json!(null),
        serde_json::json!([]),
        serde_json::json!("text"),
    ] {
        let issues = validate_jsonld(
            &serde_json::json!({"@context":"https://schema.org","@type":"FAQPage","mainEntity":main_entity}),
        );
        assert!(issues
            .iter()
            .any(|issue| issue.code == "faq-main-entity-shape-invalid"));
    }
    let issues = validate_jsonld(
        &serde_json::json!({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[null,{"@type":"Question","name":"Visible question","acceptedAnswer":{"@type":"Answer","text":"Visible answer"}}]}),
    );
    assert!(issues
        .iter()
        .any(|issue| issue.code == "faq-question-shape-invalid"));
    let missing =
        validate_jsonld(&serde_json::json!({"@context":"https://schema.org","@type":"FAQPage"}));
    assert!(missing
        .iter()
        .any(|issue| issue.code == "faq-main-entity-missing"));
}
#[test]
fn jsonld_external_and_missing_contexts_do_not_receive_schema_profiles() {
    for document in [
        json!({"@type":"Product"}),
        json!({"@context":"https://other.example/", "@type":"Product"}),
        json!({"@context":"https://schema.org", "@type":"https://other.example/Product"}),
        json!({"@context":{"other":"https://other.example/"}, "@type":"other:Product"}),
        json!({"@context":{"schema":"https://schema.org/", "@vocab":"https://other.example/"}, "@type":"Product"}),
    ] {
        let issues = validate_jsonld(&document);
        assert!(
            !issues.iter().any(|item| item.code.starts_with("product-")),
            "{document}: {issues:?}"
        );
    }
}

#[test]
fn jsonld_context_inheritance_and_reset_are_local_to_each_node() {
    let issues = validate_jsonld(&json!({
        "@context":"https://schema.org", "@graph":[
            {"@type":"Product"},
            {"@context":null, "@type":"Product"},
            {"@context":{"@vocab":"https://other.example/"}, "@type":"Product"},
            {"@type":"Product"}
        ]
    }));
    let paths = issues
        .iter()
        .filter(|item| item.code == "product-name-missing")
        .map(|item| item.path.as_deref().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(paths, vec!["$.@graph[0]", "$.@graph[3]"]);
}

#[test]
fn jsonld_top_level_array_contexts_do_not_leak_between_documents() {
    let issues = validate_jsonld(&json!([
        {"@context":"https://schema.org", "@type":"Product"},
        {"@type":"Product"},
        {"@context":"https://other.example/", "@type":"Product"}
    ]));
    let paths = issues
        .iter()
        .filter(|item| item.code == "product-name-missing")
        .map(|item| item.path.as_deref().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(paths, vec!["$[0]"]);
}

#[test]
fn jsonld_resolves_declared_schema_prefixes_terms_and_explicit_iris() {
    for document in [
        json!({"@type":"https://schema.org/Product"}),
        json!({"@context":{"s":"https://schema.org/"}, "@type":"s:Product"}),
        json!({"@context":{"s":{"@id":"https://schema.org/", "@prefix":true}}, "@type":"s:Product"}),
        json!({"@context":{"Merchandise":"https://schema.org/Product"}, "@type":"Merchandise"}),
        json!({"@context":["https://other.example/", {"@vocab":"https://schema.org/"}], "@type":"Product"}),
    ] {
        assert!(
            validate_jsonld(&document)
                .iter()
                .any(|item| item.code == "product-name-missing"),
            "{document}"
        );
    }
}

#[test]
fn jsonld_context_overrides_and_disabled_terms_suppress_profiles() {
    for context in [
        json!(["https://schema.org", {"@vocab":null}]),
        json!(["https://schema.org", {"Product":null}]),
        json!(["https://schema.org", {"Product":"https://other.example/Product"}]),
        json!(["https://schema.org", "https://unknown.example/context"]),
    ] {
        let document = json!({"@context":context, "@type":"Product"});
        assert!(
            !validate_jsonld(&document)
                .iter()
                .any(|item| item.code.starts_with("product-")),
            "{document}"
        );
    }
}
