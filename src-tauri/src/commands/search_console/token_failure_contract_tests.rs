use super::{
    connect::connect_search_console_with,
    session_edge_fixture::{dependencies, refused_endpoint, Server, Store},
    session_fixture::client,
    tokens::{exchange_code_at, refresh_access_token_at, token_json},
};

#[tokio::test]
async fn exchange_and_refresh_connection_errors_are_distinct_and_do_not_include_secrets() {
    let (endpoint, _reservation) = refused_endpoint().await;
    let client = client();
    let exchange = exchange_code_at(
        &client,
        &endpoint,
        "client",
        "private-code",
        "private-verifier",
        "http://127.0.0.1/callback",
        Some("private-secret"),
    )
    .await
    .err()
    .unwrap();
    assert_eq!(exchange, "Unable to exchange the Google OAuth code.");
    let refresh = refresh_access_token_at(
        &client,
        &endpoint,
        "client",
        "private-refresh",
        Some("private-secret"),
    )
    .await
    .unwrap_err();
    assert_eq!(refresh, "Unable to refresh the Google token.");
}

#[tokio::test]
async fn incomplete_oauth_and_report_bodies_are_read_errors() {
    for oauth in [true, false] {
        let server = Server::wire(vec![
            "HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{\"partial\":true}"
                .into(),
        ])
        .await;
        let client = client();
        let error = if oauth {
            exchange_code_at(
                &client,
                &server.endpoint,
                "client",
                "code",
                "verifier",
                "http://127.0.0.1/callback",
                None,
            )
            .await
            .err()
            .unwrap()
        } else {
            token_json("access", client.get(&server.endpoint))
                .await
                .unwrap_err()
        };
        assert_eq!(
            error,
            if oauth {
                "Google OAuth response could not be read."
            } else {
                "Google Search Console response could not be read."
            }
        );
        server.finish().await;
    }
}

#[tokio::test]
async fn connect_transport_failures_never_save_received_or_previous_credentials() {
    let (refused, _reservation) = refused_endpoint().await;
    let store = Store::with_values(&[("gsc_refresh_token_fixture-project", "old-refresh")]);
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &refused, &refused),
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error, "Unable to exchange the Google OAuth code.");
    assert!(store.writes.lock().unwrap().is_empty());

    let server = Server::new(&[(
        "200 OK",
        r#"{"access_token":"new-access","refresh_token":"new-refresh"}"#,
    )])
    .await;
    let error = connect_search_console_with(
        "fixture-project".into(),
        "fixture.apps.googleusercontent.com".into(),
        None,
        dependencies(&store, &server.endpoint, &refused),
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error, "Google Search Console request failed.");
    assert!(store.writes.lock().unwrap().is_empty());
    assert_eq!(
        store.values.lock().unwrap()["gsc_refresh_token_fixture-project"],
        "old-refresh"
    );
    server.finish().await;
}

#[tokio::test]
async fn refresh_rejects_malformed_and_missing_access_token_responses() {
    for (body, expected) in [
        ("not-json", "Google OAuth returned an invalid response."),
        (
            r#"{"access_token":42}"#,
            "Google returned an invalid OAuth response.",
        ),
        (
            r#"{"refresh_token":"private-token"}"#,
            "Google OAuth returned no access token. Connect your account again.",
        ),
    ] {
        let server = Server::new(&[("200 OK", body)]).await;
        let error = refresh_access_token_at(&client(), &server.endpoint, "client", "refresh", None)
            .await
            .unwrap_err();
        assert_eq!(error, expected);
        server.finish().await;
    }
}
