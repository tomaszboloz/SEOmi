use super::*;

#[test]
fn public_dispatch_matches_each_validator_and_reports_unsupported_format() {
    let document = serde_json::json!({"@context":"https://schema.org","@type":"Product"});
    assert_eq!(
        serde_json::to_value(validate("JSON-LD", &document)).unwrap(),
        serde_json::to_value(validate_jsonld(&document)).unwrap()
    );
    let microdata = serde_json::json!({"itemtype":"https://schema.org/Product"});
    assert_eq!(
        serde_json::to_value(validate("Microdata", &microdata)).unwrap(),
        serde_json::to_value(validate_microdata(&microdata)).unwrap()
    );
    let rdfa = serde_json::json!({"vocab":"https://schema.org","typeof":"Product"});
    assert_eq!(
        serde_json::to_value(validate("RDFa", &rdfa)).unwrap(),
        serde_json::to_value(validate_rdfa(&rdfa)).unwrap()
    );
    let unknown = validate("unsupported", &document);
    assert_eq!(unknown.len(), 1);
    assert_eq!(unknown[0].code, "schema-format-unsupported");
    assert_eq!(unknown[0].severity, "info");
}

#[test]
fn microdata_profiles_report_missing_properties_without_rejecting_external_vocabularies() {
    for (kind, property, code) in [
        (
            "BreadcrumbList",
            "itemListElement",
            "breadcrumb-items-missing",
        ),
        ("Article", "headline", "article-headline-recommended"),
        ("Organization", "name", "schema-name-missing"),
        ("FAQPage", "mainEntity", "faq-main-entity-missing"),
        ("Question", "name", "question-name-missing"),
        ("Event", "name", "event-name-missing"),
        ("Recipe", "name", "recipe-name-missing"),
        ("VideoObject", "name", "video-name-missing"),
        ("Review", "reviewBody", "review-body-missing"),
        ("Person", "name", "person-name-missing"),
        ("ImageObject", "contentUrl", "image-url-missing"),
    ] {
        let iri = format!("https://schema.org/{kind}");
        let missing = validate_microdata(&serde_json::json!({"itemtype":iri,"itemprops":[]}));
        assert!(missing.iter().any(|issue| issue.code == code), "{kind}");
        let present =
            validate_microdata(&serde_json::json!({"itemtype":iri,"itemprops":[property]}));
        assert!(!present.iter().any(|issue| issue.code == code), "{kind}");
    }
    let external =
        validate_microdata(&serde_json::json!({"itemtype":"https://other.example/Product"}));
    assert!(external
        .iter()
        .any(|issue| issue.code == "microdata-non-schema-vocabulary" && issue.severity == "info"));
    assert!(!external.iter().any(|issue| issue.severity == "error"));
    assert!(!external
        .iter()
        .any(|issue| issue.code.starts_with("product-")));
}

#[test]
fn microdata_distinguishes_empty_declarations_and_absolute_identifiers() {
    let empty = validate_microdata(&serde_json::json!({"itemtype":"  "}));
    assert!(empty
        .iter()
        .any(|issue| issue.code == "microdata-itemtype-empty"));
    let relative = validate_microdata(
        &serde_json::json!({"itemtype":"Product","itemid":"relative","itemprops":["name","NAME","",7],"itemref":["id","id","",7]}),
    );
    for code in [
        "microdata-itemtype-not-absolute",
        "microdata-itemid-not-absolute",
        "microdata-itemprop-duplicate",
        "microdata-itemprop-invalid",
        "microdata-itemref-duplicate",
        "microdata-itemref-invalid",
    ] {
        assert!(relative.iter().any(|issue| issue.code == code), "{code}");
    }
    let absolute = validate_microdata(
        &serde_json::json!({"itemtype":"https://schema.org/Thing","itemid":"https://example.com/entity","itemprops":["name"],"itemref":["id"]}),
    );
    assert!(absolute.is_empty());
}

#[test]
fn rdfa_reports_unknown_vocab_as_scope_information_and_invalid_terms_as_errors() {
    let external =
        validate_rdfa(&serde_json::json!({"vocab":"https://other.example/vocab","typeof":"Thing"}));
    assert!(external
        .iter()
        .any(|issue| issue.code == "rdfa-non-schema-vocabulary" && issue.severity == "info"));
    assert!(!external.iter().any(|issue| issue.severity == "error"));
    let malformed = validate_rdfa(
        &serde_json::json!({"vocab":"relative","typeof":42,"property":[],"rel":" ","content":null}),
    );
    assert!(malformed
        .iter()
        .any(|issue| issue.code == "rdfa-vocab-not-absolute"));
    assert_eq!(
        malformed
            .iter()
            .filter(|issue| issue.code == "rdfa-term-shape-invalid")
            .count(),
        2
    );
    assert!(malformed
        .iter()
        .any(|issue| issue.code == "rdfa-term-empty" && issue.path.as_deref() == Some("rel")));
    assert!(!malformed
        .iter()
        .any(|issue| issue.path.as_deref() == Some("content")));
}
