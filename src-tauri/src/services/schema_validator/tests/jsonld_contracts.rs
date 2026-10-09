use super::*;
use serde_json::json;

#[test]
fn reports_schema_properties_without_type_and_skips_graph_or_value_containers() {
    let issues = validate_jsonld(&json!({
        "@context": "https://schema.org",
        "name": "Untyped entity"
    }));
    let missing_type = issues
        .iter()
        .filter(|issue| issue.code == "jsonld-node-type-missing")
        .collect::<Vec<_>>();
    assert_eq!(missing_type.len(), 1);
    assert_eq!(missing_type[0].path.as_deref(), Some("$"));

    for document in [
        json!({"@context":"https://schema.org", "@graph":[], "name":"Graph container"}),
        json!({"@context":"https://schema.org", "@value":"literal", "name":"Value object"}),
    ] {
        assert!(
            !validate_jsonld(&document)
                .iter()
                .any(|issue| issue.code == "jsonld-node-type-missing"),
            "{document}"
        );
    }
}
