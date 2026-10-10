use super::{
    session_fixture::{client, responses, Store},
    tokens::refresh_access_token_with_store,
};

#[tokio::test]
async fn refresh_reports_missing_token_without_network_access() {
    let store = Store::new(&[], false);
    let error = refresh_access_token_with_store(
        &client(),
        "fixture-project",
        "fixture.apps.googleusercontent.com",
        &store,
        "http://127.0.0.1:1",
    )
    .await
    .unwrap_err();
    assert!(error.contains("token is missing"));
}

#[tokio::test]
async fn refresh_uses_optional_secret_from_store() {
    let store = Store::new(
        &[
            ("gsc_refresh_token_fixture-project", "refresh"),
            ("gsc_client_secret_fixture-project", "secret"),
        ],
        false,
    );
    let (endpoint, server) = responses(&[r#"{"access_token":"access"}"#]).await;
    assert_eq!(
        refresh_access_token_with_store(
            &client(),
            "fixture-project",
            "fixture.apps.googleusercontent.com",
            &store,
            &endpoint,
        )
        .await
        .unwrap(),
        "access"
    );
    assert!(server.await.unwrap()[0].contains("client_secret=secret"));
}
