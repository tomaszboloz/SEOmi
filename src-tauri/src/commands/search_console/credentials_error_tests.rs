use super::disconnect::revoke_refresh_token_at;
use super::oauth_response::oauth_response;
use super::rows_test_fixture::client;
use super::session_edge_fixture::{dependencies, Server, Store};
use super::tokens::refresh_access_token_with_store;
use super::transport_fixture::single_response;

const PROJECT: &str = "fixture-project";
const CLIENT: &str = "fixture.apps.googleusercontent.com";
const REFRESH: &str = "gsc_refresh_token_fixture-project";

#[tokio::test]
async fn refresh_access_token_maps_credential_store_read_errors() {
    let store_value_err = Store {
        read_error: Some((REFRESH, false)),
        ..Store::default()
    };
    let err = refresh_access_token_with_store(
        &client(),
        PROJECT,
        CLIENT,
        &store_value_err,
        "http://127.0.0.1:9",
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Search Console token is missing from the OS credential store. Connect your account again."
    );

    let store_missing = Store::default();
    let err2 = refresh_access_token_with_store(
        &client(),
        PROJECT,
        CLIENT,
        &store_missing,
        "http://127.0.0.1:9",
    )
    .await
    .unwrap_err();
    assert_eq!(
        err2,
        "Search Console token is missing from the OS credential store. Connect your account again."
    );
}

#[tokio::test]
async fn connect_search_console_reports_refresh_token_write_failure() {
    let store = Store {
        write_error: Some(REFRESH),
        ..Store::default()
    };
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"valid-access","refresh_token":"valid-refresh"}"#,
        ),
        ("200 OK", r#"{"siteEntry":[]}"#),
    ])
    .await;
    let res = super::connect::connect_search_console_with(
        PROJECT.into(),
        CLIENT.into(),
        None,
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await;
    match res {
        Err(error) => assert!(error
            .contains("Unable to save the Search Console token in the system credential store")),
        Ok(_) => panic!("expected connect error"),
    }
    server.finish().await;
}

#[tokio::test]
async fn revocation_transports_cover_all_http_outcomes() {
    let (endpoint, server) = single_response("500 Internal Server Error", "{}").await;
    let msg = revoke_refresh_token_at(&client(), &endpoint, "tok")
        .await
        .unwrap();
    assert!(msg.contains("HTTP 500 Internal Server Error"));
    server.await.unwrap();

    let (endpoint2, server2) = single_response("204 No Content", "").await;
    let msg2 = revoke_refresh_token_at(&client(), &endpoint2, "tok")
        .await
        .unwrap();
    assert_eq!(
        msg2,
        "Search Console token removed from the app and Google authorization revoked."
    );
    server2.await.unwrap();
}

#[tokio::test]
async fn oauth_response_parser_rejects_missing_access_token_and_http_errors() {
    let (endpoint, server) =
        single_response("401 Unauthorized", r#"{"error":"invalid_client"}"#).await;
    let res = client().get(&endpoint).send().await.unwrap();
    match oauth_response(res).await {
        Err(err) => assert!(err.contains("401 Unauthorized")),
        Ok(_) => panic!("expected oauth_response error"),
    }
    server.await.unwrap();

    let (endpoint2, server2) =
        single_response("200 OK", r#"{"token_type":"Bearer","access_token":"  "}"#).await;
    let res2 = client().get(&endpoint2).send().await.unwrap();
    match oauth_response(res2).await {
        Err(err2) => assert_eq!(
            err2,
            "Google OAuth returned no access token. Connect your account again."
        ),
        Ok(_) => panic!("expected oauth_response error"),
    }
    server2.await.unwrap();
}
