use super::disconnect::revoke_refresh_token_at;
use super::rows_test_fixture::client;
use super::transport_fixture::single_response;

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
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);
    let error = revoke_refresh_token_at(&client(), &endpoint, "synthetic-refresh")
        .await
        .unwrap();
    assert!(error.starts_with(
        "The token was removed from the app, but Google consent revocation could not be confirmed"
    ));
    assert!(!error.contains("synthetic-refresh"));
}
