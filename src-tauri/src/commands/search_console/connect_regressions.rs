use super::{
    connect::connect_search_console_with,
    session_test_modules::{dependencies, Server, Store},
};

const PROJECT: &str = "fixture-project";
const CLIENT: &str = "fixture.apps.googleusercontent.com";
const SCOPE: &str = "https://www.googleapis.com/auth/webmasters.readonly";

#[tokio::test]
async fn token_endpoint_failure_is_returned_without_credential_writes() {
    let store = Store::default();
    let server = Server::new(&[(
        "500 Internal Server Error",
        r#"{"error":"temporarily_unavailable"}"#,
    )])
    .await;

    let error = connect_search_console_with(
        PROJECT.into(),
        CLIENT.into(),
        None,
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await
    .unwrap_err();

    assert!(error.contains("Google OAuth HTTP 500"), "{error}");
    assert!(store.writes.lock().unwrap().is_empty());
    assert_eq!(server.finish().await.len(), 1);
}

#[tokio::test]
async fn properties_endpoint_failure_is_returned_without_persisting_tokens() {
    let store = Store::default();
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"fixture-access","refresh_token":"fixture-refresh"}"#,
        ),
        (
            "503 Service Unavailable",
            r#"{"error":{"status":"UNAVAILABLE"}}"#,
        ),
    ])
    .await;

    let error = super::connect::connect_with_scope(
        PROJECT.into(),
        CLIENT.into(),
        None,
        dependencies(&store, &server.endpoint, &server.endpoint),
        SCOPE,
    )
    .await
    .unwrap_err();

    assert!(error.contains("Google Search Console HTTP 503"), "{error}");
    assert!(store.writes.lock().unwrap().is_empty());
    assert_eq!(server.finish().await.len(), 2);
}
