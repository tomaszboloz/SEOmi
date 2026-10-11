use super::*;
use serde_json::json;

fn codes(content: Value) -> Vec<String> {
    validate_microdata(&content)
        .into_iter()
        .map(|issue| issue.code)
        .collect()
}

#[test]
fn itemid_must_be_an_absolute_url_with_a_host_when_present() {
    let itemtype = "https://schema.org/Product";
    for (itemid, flagged) in [
        ("", false),
        ("   ", false),
        ("https://example.com/p/1", false),
        ("urn:isbn:0451450523", true),
        ("/relative/id", true),
    ] {
        let found = codes(json!({"itemtype": itemtype, "itemid": itemid}));
        assert_eq!(
            found.contains(&"microdata-itemid-not-absolute".to_string()),
            flagged,
            "{itemid}"
        );
    }
}

#[test]
fn itemtype_iris_without_a_host_are_not_absolute() {
    assert!(codes(json!({"itemtype": "urn:example:Thing"}))
        .contains(&"microdata-itemtype-not-absolute".to_string()));
    assert!(!codes(json!({"itemtype": "https://schema.org/Thing"}))
        .contains(&"microdata-itemtype-not-absolute".to_string()));
}
