use super::{
    connect::connect_search_console_with,
    session_edge_fixture::{dependencies, form, Server, Store},
};

const PROJECT: &str = "fixture-project";
const CLIENT: &str = "fixture.apps.googleusercontent.com";
const REFRESH: &str = "gsc_refresh_token_fixture-project";
const SECRET: &str = "gsc_client_secret_fixture-project";

#[tokio::test]
async fn successful_connect_replaces_only_this_projects_credentials_after_listing_properties() {
    let store = Store::with_values(&[
        (REFRESH, "old"),
        (SECRET, "old-secret"),
        ("gsc_refresh_token_other", "other-refresh"),
    ]);
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"fresh-access","refresh_token":"fresh-refresh"}"#,
        ),
        (
            "200 OK",
            r#"{"siteEntry":[{"siteUrl":"sc-domain:example.test","permissionLevel":"siteOwner"}]}"#,
        ),
    ])
    .await;
    let properties = connect_search_console_with(
        PROJECT.into(),
        format!(" {CLIENT} "),
        Some("new+secret&value".into()),
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await
    .unwrap();
    assert_eq!(properties.len(), 1);
    assert_eq!(properties[0].site_url, "sc-domain:example.test");
    assert_eq!(
        *store.writes.lock().unwrap(),
        vec![
            (REFRESH.into(), "fresh-refresh".into()),
            (SECRET.into(), "new+secret&value".into())
        ]
    );
    assert_eq!(
        store.values.lock().unwrap()["gsc_refresh_token_other"],
        "other-refresh"
    );
    assert_eq!(*store.reads.lock().unwrap(), vec![REFRESH]);
    let requests = server.finish().await;
    let fields = form(&requests[0]);
    assert_eq!(fields["client_id"], CLIENT);
    assert_eq!(fields["code"], "fixture-code");
    assert_eq!(fields["client_secret"], "new+secret&value");
    assert_eq!(fields["grant_type"], "authorization_code");
    assert_eq!(fields["code_verifier"].len(), 64);
    assert!(fields["redirect_uri"].starts_with("http://127.0.0.1:"));
    assert!(fields["redirect_uri"].ends_with("/oauth2callback"));
    assert!(requests[1]
        .to_ascii_lowercase()
        .contains("authorization: bearer fresh-access\r\n"));
}

#[tokio::test]
async fn properties_http_and_schema_failures_preserve_previous_credentials() {
    for (status, body, expected) in [
        (
            "403 Forbidden",
            r#"{"error":{"message":"private-provider-details"}}"#,
            "Google Search Console HTTP 403",
        ),
        (
            "200 OK",
            r#"{"siteEntry":42}"#,
            "Google returned an invalid property list.",
        ),
    ] {
        let store = Store::with_values(&[(REFRESH, "old"), (SECRET, "old-secret")]);
        let server = Server::new(&[
            (
                "200 OK",
                r#"{"access_token":"new","refresh_token":"new-refresh"}"#,
            ),
            (status, body),
        ])
        .await;
        let error = connect_search_console_with(
            PROJECT.into(),
            CLIENT.into(),
            Some("new-secret".into()),
            dependencies(&store, &server.endpoint, &server.endpoint),
        )
        .await
        .err()
        .unwrap();
        assert!(error.starts_with(expected), "{error}");
        assert!(!error.contains("private-provider-details"));
        assert!(store.writes.lock().unwrap().is_empty());
        assert_eq!(store.values.lock().unwrap()[REFRESH], "old");
        assert_eq!(store.values.lock().unwrap()[SECRET], "old-secret");
        assert_eq!(server.finish().await.len(), 2);
    }
}

#[tokio::test]
async fn missing_refresh_token_does_not_query_properties_or_write_credentials() {
    let store = Store::with_values(&[("gsc_refresh_token_other", "other-token")]);
    let server = Server::new(&[("200 OK", r#"{"access_token":"new"}"#)]).await;
    let error = connect_search_console_with(
        PROJECT.into(),
        CLIENT.into(),
        None,
        dependencies(&store, &server.endpoint, "invalid-sites-endpoint"),
    )
    .await
    .err()
    .unwrap();
    assert!(error.starts_with("Google did not return a refresh token."));
    assert!(store.writes.lock().unwrap().is_empty());
    assert!(!store
        .reads
        .lock()
        .unwrap()
        .iter()
        .any(|key| key.ends_with("_other")));
    assert_eq!(server.finish().await.len(), 1);
}
