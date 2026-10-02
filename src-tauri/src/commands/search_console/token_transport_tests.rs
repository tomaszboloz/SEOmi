use super::tokens::token_json;
use serde_json::json;
use tokio::{io::AsyncWriteExt, net::TcpListener};

async fn response(status: &str, body: &str) -> (String, tokio::task::JoinHandle<String>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let wire = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let request = super::callback_io::read_callback_request(
            &mut stream,
            std::time::Duration::from_secs(1),
        )
        .await
        .unwrap();
        stream.write_all(wire.as_bytes()).await.unwrap();
        request
    });
    (endpoint, task)
}

#[tokio::test]
async fn successful_json_uses_bearer_authentication_and_preserves_payload() {
    let (endpoint, server) = response("200 OK", r#"{"rows":[],"zero":0,"absent":null}"#).await;
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    assert_eq!(
        token_json("synthetic-token", client.get(endpoint))
            .await
            .unwrap(),
        json!({"rows":[], "zero":0, "absent":null})
    );
    assert!(server
        .await
        .unwrap()
        .to_lowercase()
        .contains("authorization: bearer synthetic-token\r\n"));
}

#[tokio::test]
async fn missing_or_non_string_provider_messages_have_an_explicit_fallback() {
    for body in ["{}", r#"{"error":{"message":42}}"#] {
        let (endpoint, server) = response("429 Too Many Requests", body).await;
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let error = token_json("synthetic", client.get(endpoint))
            .await
            .unwrap_err();
        assert!(error.contains("429"));
        assert!(error.ends_with("unknown API error"));
        server.await.unwrap();
    }
}

#[tokio::test]
async fn malformed_json_is_not_accepted_as_data() {
    let (endpoint, server) = response("200 OK", "not-json").await;
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    assert!(token_json("synthetic", client.get(endpoint))
        .await
        .unwrap_err()
        .starts_with("Google Search Console returned an invalid response:"));
    server.await.unwrap();
}

#[tokio::test]
async fn connection_failure_is_reported() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    assert!(token_json("synthetic", client.get(endpoint))
        .await
        .unwrap_err()
        .starts_with("Google Search Console request failed:"));
}
