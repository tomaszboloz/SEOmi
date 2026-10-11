use super::{
    connect::{connect_with_scope, oauth_request},
    session_test_modules::{dependencies, Server, Store},
};

#[test]
fn oauth_request_uses_canonical_scope_and_loopback() {
    let (redirect, state, verifier, url) =
        oauth_request("test.apps.googleusercontent.com", 9090).unwrap();
    assert_eq!(redirect, "http://127.0.0.1:9090/oauth2callback");
    assert_eq!(state.len(), 32);
    assert_eq!(verifier.len(), 64);
    assert!(url
        .as_str()
        .contains("https://accounts.google.com/o/oauth2/v2/auth"));
    assert!(url.as_str().contains("auth%2Fwebmasters.readonly"));
}

#[tokio::test]
async fn connect_with_scope_custom_scope_and_client_secret_persisted() {
    let store = Store::default();
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"token-acc","refresh_token":"token-ref"}"#,
        ),
        (
            "200 OK",
            r#"{"siteEntry":[{"siteUrl":"sc-domain:example.com","permissionLevel":"siteOwner"}]}"#,
        ),
    ])
    .await;
    let custom_scope = "https://www.googleapis.com/auth/custom.scope";
    let properties = connect_with_scope(
        "proj-1".into(),
        "test.apps.googleusercontent.com".into(),
        Some("client-secret-val".into()),
        dependencies(&store, &server.endpoint, &server.endpoint),
        custom_scope,
    )
    .await
    .unwrap();
    assert_eq!(properties.len(), 1);
    assert_eq!(properties[0].site_url, "sc-domain:example.com");

    let writes = store.writes.lock().unwrap().clone();
    assert!(writes
        .iter()
        .any(|(k, v)| k == "gsc_refresh_token_proj-1" && v == "token-ref"));
    assert!(writes
        .iter()
        .any(|(k, v)| k == "gsc_client_secret_proj-1" && v == "client-secret-val"));
    assert_eq!(server.finish().await.len(), 2);
}

#[tokio::test]
async fn connect_with_scope_falls_back_to_old_refresh_token() {
    let store = Store::with_values(&[("gsc_refresh_token_proj-old", "existing-refresh")]);
    let server = Server::new(&[
        ("200 OK", r#"{"access_token":"new-acc"}"#),
        ("200 OK", r#"{"siteEntry":[]}"#),
    ])
    .await;
    let properties = connect_with_scope(
        "proj-old".into(),
        "test.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &server.endpoint, &server.endpoint),
        "https://www.googleapis.com/auth/webmasters.readonly",
    )
    .await
    .unwrap();
    assert!(properties.is_empty());
    let writes = store.writes.lock().unwrap().clone();
    assert!(writes
        .iter()
        .any(|(k, v)| k == "gsc_refresh_token_proj-old" && v == "existing-refresh"));
    assert_eq!(server.finish().await.len(), 2);
}

#[tokio::test]
async fn connect_with_scope_secret_write_failure_reports_error() {
    let store = Store {
        write_error: Some("gsc_client_secret_proj-fail"),
        ..Store::default()
    };
    let server = Server::new(&[
        ("200 OK", r#"{"access_token":"acc","refresh_token":"ref"}"#),
        ("200 OK", r#"{"siteEntry":[]}"#),
    ])
    .await;
    let err = connect_with_scope(
        "proj-fail".into(),
        "test.apps.googleusercontent.com".into(),
        Some("secret-to-save".into()),
        dependencies(&store, &server.endpoint, &server.endpoint),
        "https://www.googleapis.com/auth/webmasters.readonly",
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Unable to save the Search Console client secret: fixture write rejected"
    );
    assert_eq!(server.finish().await.len(), 2);
}

#[tokio::test]
async fn connect_search_console_production_entry_validates_client_id() {
    let err = super::connect::connect_search_console(
        "proj-prod".into(),
        "invalid client id".into(),
        None,
    )
    .await
    .unwrap_err();
    assert!(err.contains("OAuth Client ID"));
}
