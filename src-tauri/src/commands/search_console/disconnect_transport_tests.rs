use super::disconnect::revoke_refresh_token_at;
use super::rows_test_fixture::client;
use super::transport_fixture::{closed_response, single_response};

#[tokio::test]
async fn revocation_reports_success_and_provider_status_without_exposing_token() {
    let (endpoint, server) = single_response("200 OK", "{}").await;
    let success = revoke_refresh_token_at(&client(), &endpoint, "synthetic-refresh")
        .await
        .unwrap();
    assert_eq!(
        success,
        "Search Console token removed from the app and Google authorization revoked."
    );
    let (headers, body) = server.await.unwrap();
    assert!(headers.starts_with("post / http/1.1"));
    assert!(String::from_utf8(body)
        .unwrap()
        .contains("token=synthetic-refresh"));

    let (endpoint, server) = single_response("403 Forbidden", "{}").await;
    let status = revoke_refresh_token_at(&client(), &endpoint, "synthetic-refresh")
        .await
        .unwrap();
    assert!(status.contains("HTTP 403"));
    assert!(!status.contains("synthetic-refresh"));
    server.await.unwrap();
}

#[tokio::test]
async fn revocation_network_failure_is_reported_as_local_cleanup_warning() {
    let (endpoint, server) = closed_response().await;
    let error = revoke_refresh_token_at(&client(), &endpoint, "synthetic-refresh")
        .await
        .unwrap();
    assert!(error.starts_with(
        "The token was removed from the app, but Google consent revocation could not be confirmed"
    ));
    assert!(!error.contains("synthetic-refresh"));
    server.await.unwrap();
}

#[tokio::test]
async fn revocation_form_encodes_reserved_characters_without_query_or_bearer() {
    let token = "synthetic+refresh&token=part /ż";
    let (endpoint, server) = single_response("204 No Content", "").await;
    let message = revoke_refresh_token_at(&client(), &endpoint, token)
        .await
        .unwrap();
    assert!(message.ends_with("Google authorization revoked."));
    assert!(!message.contains(token));
    let (headers, body) = server.await.unwrap();
    assert!(headers.starts_with("post / http/1.1\r\n"));
    assert!(headers.contains("content-type: application/x-www-form-urlencoded\r\n"));
    assert!(!headers.contains("authorization:"));
    let form: Vec<_> = url::form_urlencoded::parse(&body).into_owned().collect();
    assert_eq!(form, vec![("token".to_string(), token.to_string())]);
}

#[tokio::test]
async fn revocation_provider_errors_do_not_expose_response_body() {
    let (endpoint, server) = single_response(
        "500 Internal Server Error",
        "synthetic-refresh private details",
    )
    .await;
    let message = revoke_refresh_token_at(&client(), &endpoint, "synthetic-refresh")
        .await
        .unwrap();
    assert!(message.contains("HTTP 500"));
    assert!(!message.contains("synthetic-refresh"));
    assert!(!message.contains("private details"));
    server.await.unwrap();
}
