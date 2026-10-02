use super::{oauth_response::oauth_response, token_transport_tests::response};

async fn decode(status: &str, body: &str) -> Result<super::models::TokenResponse, String> {
    let (endpoint, server) = response(status, body).await;
    let reply = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap()
        .get(endpoint)
        .send()
        .await
        .unwrap();
    let result = oauth_response(reply).await;
    server.await.unwrap();
    result
}

#[tokio::test]
async fn valid_tokens_are_preserved_without_forwarding_unknown_fields() {
    let value = decode("200 OK", r#"{"access_token":"synthetic-access","refresh_token":"synthetic-refresh","extra":"ignored"}"#).await.unwrap();
    assert_eq!(value.access_token.as_deref(), Some("synthetic-access"));
    assert_eq!(value.refresh_token.as_deref(), Some("synthetic-refresh"));
    assert!(decode("200 OK", r#"{"access_token":"synthetic"}"#)
        .await
        .unwrap()
        .refresh_token
        .is_none());
}

#[tokio::test]
async fn missing_empty_whitespace_and_malformed_access_tokens_are_errors() {
    for body in [
        "{}",
        r#"{"access_token":null}"#,
        r#"{"access_token":""}"#,
        r#"{"access_token":"  "}"#,
    ] {
        assert_eq!(
            decode("200 OK", body).await.err().unwrap(),
            "Google OAuth returned no access token. Connect your account again."
        );
    }
    assert_eq!(
        decode("200 OK", r#"{"access_token":42}"#)
            .await
            .err()
            .unwrap(),
        "Google returned an invalid OAuth response."
    );
}

#[tokio::test]
async fn oauth_errors_are_bounded_and_do_not_return_provider_descriptions() {
    let error = decode(
        "400 Bad Request",
        r#"{"error":"invalid_grant","error_description":"synthetic-secret"}"#,
    )
    .await
    .err()
    .unwrap();
    assert!(error.contains("400"));
    assert!(!error.contains("synthetic-secret"));
    let body = format!("{{\"access_token\":\"{}\"}}", "x".repeat(64 * 1024));
    assert!(decode("200 OK", &body)
        .await
        .err()
        .unwrap()
        .contains("safety limit"));
}
