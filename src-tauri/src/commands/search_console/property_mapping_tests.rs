use super::properties::parse_properties;
use serde_json::json;

#[test]
fn preserves_recorded_property_urls_and_permissions_without_inventing_entries() {
    let result = parse_properties(json!({"siteEntry":[
        {"siteUrl":"sc-domain:example.com","permissionLevel":"siteOwner"},
        {"siteUrl":"https://example.org/","permissionLevel":"siteRestrictedUser"}
    ]}))
    .unwrap();
    assert_eq!(result.len(), 2);
    assert_eq!(result[0].site_url, "sc-domain:example.com");
    assert_eq!(result[0].permission_level, "siteOwner");
    assert_eq!(result[1].permission_level, "siteRestrictedUser");
    for body in [
        json!({}),
        json!({"siteEntry":null}),
        json!({"siteEntry":[]}),
    ] {
        assert!(parse_properties(body).unwrap().is_empty());
    }
}

#[test]
fn malformed_properties_return_a_local_error_without_raw_provider_content() {
    for body in [
        json!({"siteEntry":42}),
        json!({"siteEntry":[{"siteUrl":42}]}),
        json!({"siteEntry":[{"siteUrl":"https://example.com","permissionLevel":42}]}),
    ] {
        assert_eq!(
            parse_properties(body).err().unwrap(),
            "Google returned an invalid property list."
        );
    }
}
