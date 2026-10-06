use super::{
    list_search_console_properties,
    properties::site_properties_at,
    rows_test_fixture::client,
    transport_fixture::{closed_response, single_response},
};
const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";

#[tokio::test]
async fn public_properties_reject_invalid_project_before_keyring_access() {
    for project in [
        "".to_string(),
        "bad project".into(),
        "../other".into(),
        "a".repeat(81),
    ] {
        let error = list_search_console_properties(project, CLIENT_ID.into())
            .await
            .unwrap_err();
        assert_eq!(error, "Invalid Google Search Console project identifier.");
    }
}

#[tokio::test]
async fn site_properties_transport_distinguishes_empty_lists_from_invalid_entries() {
    for body in ["{}", r#"{"siteEntry":null}"#, r#"{"siteEntry":[]}"#] {
        let (endpoint, server) = single_response("200 OK", body).await;
        assert!(site_properties_at(&client(), "synthetic-token", &endpoint)
            .await
            .unwrap()
            .is_empty());
        server.await.unwrap();
    }
    for body in [
        r#"{"siteEntry":{}}"#,
        r#"{"siteEntry":[{}]}"#,
        r#"{"siteEntry":[{"siteUrl":"sc-domain:fixture.test"}]}"#,
        r#"{"siteEntry":[{"siteUrl":12,"permissionLevel":"siteOwner"}]}"#,
    ] {
        let (endpoint, server) = single_response("200 OK", body).await;
        assert_eq!(
            site_properties_at(&client(), "synthetic-token", &endpoint)
                .await
                .unwrap_err(),
            "Google returned an invalid property list."
        );
        server.await.unwrap();
    }
}

#[tokio::test]
async fn site_properties_transport_reports_closed_connection() {
    let (endpoint, server) = closed_response().await;
    let error = site_properties_at(&client(), "synthetic-token", &endpoint)
        .await
        .unwrap_err();
    assert_eq!(error, "Google Search Console request failed.");
    server.await.unwrap();
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
        .unwrap_err();
    assert!(error.contains("403"));
    assert!(!error.contains("private"));
    server.await.unwrap();

    let (endpoint, server) = single_response("200 OK", "not-json").await;
    let error = site_properties_at(&client(), "synthetic-token", &endpoint)
        .await
        .unwrap_err();
    assert!(error.starts_with("Google Search Console returned an invalid response"));
    server.await.unwrap();
    assert!(super::properties::parse_properties(serde_json::json!({}))
        .unwrap()
        .is_empty());
}
