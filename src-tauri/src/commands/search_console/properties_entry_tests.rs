use super::{
    properties::{list_search_console_properties, site_properties_at},
    rows_test_fixture::client,
    transport_fixture::single_response,
};
const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";

#[tokio::test]
async fn public_properties_reject_invalid_project_before_keyring_access() {
    let error = list_search_console_properties("bad project".into(), CLIENT_ID.into())
        .await
        .err()
        .expect("invalid project must be rejected");
    assert_eq!(error, "Invalid Google Search Console project identifier.");
}

#[tokio::test]
async fn site_properties_transport_preserves_entries_and_bearer() {
    let body =
        r#"{"siteEntry":[{"siteUrl":"sc-domain:fixture.test","permissionLevel":"siteOwner"}]}"#;
    let (endpoint, server) = single_response("200 OK", body).await;
    let properties = site_properties_at(&client(), "synthetic-token", &endpoint)
        .await
        .unwrap();
    assert_eq!(properties.len(), 1);
    assert_eq!(properties[0].site_url, "sc-domain:fixture.test");
    assert_eq!(properties[0].permission_level, "siteOwner");
    let (headers, request_body) = server.await.unwrap();
    assert!(headers.starts_with("get / http/1.1"));
    assert!(headers.contains("authorization: bearer synthetic-token\r\n"));
    assert!(request_body.is_empty());
}

#[tokio::test]
async fn site_properties_rejects_provider_status_and_malformed_json() {
    let (endpoint, server) =
        single_response("403 Forbidden", r#"{"error":{"message":"private"}}"#).await;
    let error = site_properties_at(&client(), "synthetic-token", &endpoint)
        .await
        .err()
        .expect("provider status must be rejected");
    assert!(error.contains("403"));
    assert!(!error.contains("private"));
    server.await.unwrap();

    let (endpoint, server) = single_response("200 OK", "not-json").await;
    let error = site_properties_at(&client(), "synthetic-token", &endpoint)
        .await
        .err()
        .expect("malformed provider response must be rejected");
    assert!(error.starts_with("Google Search Console returned an invalid response"));
    server.await.unwrap();
    assert!(super::properties::parse_properties(serde_json::json!({}))
        .unwrap()
        .is_empty());
}

struct FailingResolver;
impl reqwest::dns::Resolve for FailingResolver {
    fn resolve(&self, _: reqwest::dns::Name) -> reqwest::dns::Resolving {
        Box::pin(async { Err(std::io::Error::other("offline").into()) })
    }
}

#[tokio::test]
async fn site_properties_fails_cleanly_on_network_error() {
    let client = reqwest::Client::builder()
        .dns_resolver(std::sync::Arc::new(FailingResolver))
        .no_proxy()
        .build()
        .unwrap();
    let err = super::properties::site_properties(&client, "token")
        .await
        .err()
        .expect("connection must fail");
    assert_eq!(err, "Google Search Console request failed.");
}
