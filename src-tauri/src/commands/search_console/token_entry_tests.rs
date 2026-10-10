use super::tokens::{authorized_json_with_access_token, exchange_code_at, refresh_access_token_at};
use serde_json::json;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::Duration,
};

async fn fixture(body: &str) -> (String, tokio::task::JoinHandle<String>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let response_body = body.to_string();
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        loop {
            let mut byte = [0u8];
            stream.read_exact(&mut byte).await.unwrap();
            request.push(byte[0]);
            if request.ends_with(b"\r\n\r\n") {
                break;
            }
        }
        let headers = String::from_utf8_lossy(&request).to_ascii_lowercase();
        let length = headers
            .lines()
            .find_map(|line| line.strip_prefix("content-length: "))
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or_default();
        let mut payload = vec![0; length];
        stream.read_exact(&mut payload).await.unwrap();
        request.extend(payload);
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            response_body.len(), response_body
        );
        stream.write_all(response.as_bytes()).await.unwrap();
        String::from_utf8(request).unwrap()
    });
    (endpoint, task)
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap()
}

#[tokio::test]
async fn exchange_and_refresh_helpers_send_oauth_forms_without_exposing_tokens() {
    let (endpoint, server) =
        fixture(r#"{"access_token":"access","refresh_token":"refresh"}"#).await;
    let token = exchange_code_at(
        &client(),
        &endpoint,
        "fixture-client",
        "fixture-code",
        "fixture-verifier",
        "http://127.0.0.1/callback",
        Some("fixture-secret"),
    )
    .await
    .unwrap();
    assert_eq!(token.access_token.as_deref(), Some("access"));
    let request = server.await.unwrap();
    assert!(request.contains("grant_type=authorization_code"));
    assert!(request.contains("client_secret=fixture-secret"));
    assert!(request.contains("code_verifier=fixture-verifier"));

    let (endpoint, server) = fixture(r#"{"access_token":"refreshed"}"#).await;
    let access = refresh_access_token_at(
        &client(),
        &endpoint,
        "fixture-client",
        "fixture-refresh",
        Some("fixture-secret"),
    )
    .await
    .unwrap();
    assert_eq!(access, "refreshed");
    let request = server.await.unwrap();
    assert!(request.contains("grant_type=refresh_token"));
    assert!(request.contains("refresh_token=fixture-refresh"));
    assert!(request.contains("client_secret=fixture-secret"));
}

#[tokio::test]
async fn whitespace_secret_is_omitted_and_authorized_helper_uses_bearer() {
    let (endpoint, server) = fixture(r#"{"access_token":"access"}"#).await;
    exchange_code_at(
        &client(),
        &endpoint,
        "fixture-client",
        "fixture-code",
        "fixture-verifier",
        "http://127.0.0.1/callback",
        Some("   "),
    )
    .await
    .unwrap();
    assert!(!server.await.unwrap().contains("client_secret"));

    let (endpoint, server) = fixture(r#"{"ok":true}"#).await;
    let result = authorized_json_with_access_token("fixture-access", client().get(endpoint))
        .await
        .unwrap();
    assert_eq!(result, json!({"ok": true}));
    assert!(server
        .await
        .unwrap()
        .to_ascii_lowercase()
        .contains("authorization: bearer fixture-access"));
}
