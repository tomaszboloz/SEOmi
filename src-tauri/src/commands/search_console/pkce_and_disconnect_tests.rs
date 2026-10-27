use super::inspection::inspection_request;
use super::pkce::code_challenge;
use super::rows_test_fixture::client;
use super::tokens::{authorized_json_with_access_token, exchange_code_at, token_json};
use super::transport_fixture::single_response;
use url::Url;

#[test]
fn pkce_code_challenge_is_deterministic_and_url_safe() {
    let verifier = "test-verifier-string-with-sufficient-entropy-12345";
    let challenge1 = code_challenge(verifier);
    let challenge2 = code_challenge(verifier);
    assert_eq!(challenge1, challenge2);
    assert!(!challenge1.contains('+'));
    assert!(!challenge1.contains('/'));
    assert!(!challenge1.contains('='));

    let challenge_diff = code_challenge("different-verifier");
    assert_ne!(challenge1, challenge_diff);
}

#[tokio::test]
async fn oauth_exchange_reports_pkce_mismatch_and_preserves_error() {
    let (endpoint, server) = single_response(
        "400 Bad Request",
        r#"{"error":"invalid_grant","error_description":"PKCE verification failed"}"#,
    )
    .await;
    let res = exchange_code_at(
        &client(),
        &endpoint,
        "client-id",
        "code",
        "mismatched-verifier",
        "http://127.0.0.1/callback",
        None,
    )
    .await;
    match res {
        Err(err) => {
            // The fixed reason and hint are named; provider text still is not.
            assert_eq!(err, "Google OAuth HTTP 400 Bad Request: request failed (invalid_grant). The sign-in expired or access was revoked. Connect the account again.");
            assert!(!err.contains("PKCE verification failed"));
            assert!(!err.contains("mismatched-verifier"));
        }
        Ok(_) => panic!("expected oauth exchange error"),
    }
    server.await.unwrap();
}

#[tokio::test]
async fn inspection_network_failures_and_errors_are_handled() {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let dead_endpoint = format!("http://127.0.0.1:{port}/index:inspect");

    let inspection_url = Url::parse("https://example.test/").unwrap();
    let req = inspection_request(
        &client(),
        &dead_endpoint,
        "sc-domain:example.test",
        &inspection_url,
    );
    let err = authorized_json_with_access_token("valid-token", req)
        .await
        .unwrap_err();
    assert_eq!(err, "Google Search Console request failed.");

    let (endpoint, server) = single_response("404 Not Found", "{}").await;
    let req2 = client().get(&endpoint);
    let err2 = token_json("token", req2).await.unwrap_err();
    assert_eq!(
        err2,
        "Google Search Console HTTP 404 Not Found: request failed."
    );
    server.await.unwrap();

    let (endpoint3, server3) =
        single_response("200 OK", r#"{"error":"malformed non-object"}"#).await;
    let req3 = client().get(&endpoint3);
    let val = token_json("token", req3).await.unwrap();
    assert_eq!(val["error"], "malformed non-object");
    server3.await.unwrap();
}
