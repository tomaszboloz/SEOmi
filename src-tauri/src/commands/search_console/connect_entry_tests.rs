use super::{
    connect::{connect_search_console_with, oauth_request},
    session_test_modules::{dependencies, Server, Store},
};
use std::collections::HashMap;

#[test]
fn oauth_request_contains_pkce_and_local_callback_contract() {
    let (redirect_uri, state, verifier, url) =
        oauth_request("fixture.apps.googleusercontent.com", 43127).unwrap();
    assert_eq!(redirect_uri, "http://127.0.0.1:43127/oauth2callback");
    assert_eq!(state.len(), 32);
    assert_eq!(verifier.len(), 64);
    let query = url.query_pairs().into_owned().collect::<HashMap<_, _>>();
    assert_eq!(query["client_id"], "fixture.apps.googleusercontent.com");
    assert_eq!(query["redirect_uri"], redirect_uri);
    assert_eq!(query["response_type"], "code");
    assert_eq!(
        query["scope"],
        "https://www.googleapis.com/auth/webmasters.readonly"
    );
    assert_eq!(query["state"], state);
    assert_eq!(query["code_challenge_method"], "S256");
    assert_eq!(query["access_type"], "offline");
    assert_eq!(query["prompt"], "consent");
    assert_eq!(query["code_challenge"].len(), 43);
}

#[tokio::test]
async fn connect_rejects_oauth_without_a_refresh_token() {
    let store = Store::default();
    let server = Server::new(&[("200 OK", r#"{"access_token":"fixture-access"}"#)]).await;
    let result = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await;
    match result {
        Err(error) => assert_eq!(
            error,
            "Google did not return a refresh token. Revoke SEOmi access in your Google account and connect again."
        ),
        Ok(_) => panic!("missing refresh token must fail"),
    }
    assert_eq!(server.finish().await.len(), 1);
}

#[tokio::test]
async fn blank_client_secret_is_not_persisted_as_a_credential() {
    let store = Store::default();
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"fixture-access","refresh_token":"fixture-refresh"}"#,
        ),
        ("200 OK", r#"{"siteEntry":[]}"#),
    ])
    .await;
    let properties = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        Some("   ".into()),
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await
    .unwrap();
    assert!(properties.is_empty());
    assert_eq!(
        store.writes.lock().unwrap().as_slice(),
        [(
            "gsc_refresh_token_fixture-project".into(),
            "fixture-refresh".into()
        )]
    );
    assert_eq!(server.finish().await.len(), 2);
}

#[tokio::test]
async fn connect_rejects_oauth_without_an_access_token() {
    let store = Store::default();
    let server = Server::new(&[("200 OK", r#"{"refresh_token":"fixture-refresh"}"#)]).await;
    let result = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await;
    match result {
        Err(error) => assert_eq!(
            error,
            "Google OAuth returned no access token. Connect your account again."
        ),
        Ok(_) => panic!("missing access token must fail"),
    }
    assert_eq!(server.finish().await.len(), 1);
}
