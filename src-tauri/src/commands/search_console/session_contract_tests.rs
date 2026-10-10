use super::{
    connect::connect_search_console_with,
    session_fixture::{
        browser_error, browser_ok, callback_error, dependencies, dependencies_with_callback,
        responses, Store,
    },
};

#[tokio::test]
async fn connect_uses_old_refresh_token_and_stored_secret() {
    let store = Store::new(
        &[
            ("gsc_refresh_token_fixture-project", "old-refresh"),
            ("gsc_client_secret_fixture-project", "stored-secret"),
        ],
        false,
    );
    let (endpoint, server) =
        responses(&[r#"{"access_token":"access"}"#, r#"{"siteEntry":[]}"#]).await;
    let properties = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &endpoint, browser_ok),
    )
    .await
    .unwrap();
    assert!(properties.is_empty());
    let requests = server.await.unwrap();
    assert!(requests[0].contains("client_secret=stored-secret"));
    assert!(requests[1]
        .to_ascii_lowercase()
        .contains("authorization: bearer access"));
    assert_eq!(
        store.value("gsc_refresh_token_fixture-project").as_deref(),
        Some("old-refresh")
    );
}

#[tokio::test]
async fn connect_reports_missing_access_token_and_write_failures() {
    let store = Store::new(&[], false);
    let (endpoint, server) = responses(&[r#"{"refresh_token":"new"}"#]).await;
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &endpoint, browser_ok),
    )
    .await
    .err()
    .expect("missing access token must fail");
    assert!(error.contains("no access token"));
    assert_eq!(server.await.unwrap().len(), 1);

    let store = Store::new(&[], true);
    let (endpoint, server) = responses(&[
        r#"{"access_token":"access","refresh_token":"refresh"}"#,
        r#"{"siteEntry":[]}"#,
    ])
    .await;
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &endpoint, browser_ok),
    )
    .await
    .err()
    .expect("credential write failure must fail");
    assert!(error.contains("save the Search Console token"));
    server.await.unwrap();
}

#[tokio::test]
async fn connect_propagates_browser_failure() {
    let store = Store::new(&[], false);
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, "http://127.0.0.1:1", browser_error),
    )
    .await
    .err()
    .expect("browser failure must fail");
    assert_eq!(error, "synthetic browser failure");

    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies_with_callback(&store, "http://127.0.0.1:1", browser_ok, callback_error),
    )
    .await
    .err()
    .expect("callback failure must fail");
    assert_eq!(error, "synthetic callback failure");
}
