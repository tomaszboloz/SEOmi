use super::response_json;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn response(status: &str, body: &[u8]) -> reqwest::Response {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let header =
        format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n");
    let body = body.to_vec();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0u8; 8192];
        assert!(socket.read(&mut request).await.unwrap() > 0);
        if socket.write_all(header.as_bytes()).await.is_ok() {
            let _ = socket.write_all(&body).await;
        }
    });
    reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap()
        .get(endpoint)
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn provider_error_does_not_disclose_response_text() {
    let reply = response(
        "403 Forbidden",
        br#"{"error":{"message":"synthetic-secret-from-provider"}}"#,
    )
    .await;
    let error = response_json(reply).await.unwrap_err();
    assert!(error.contains("403"));
    assert!(!error.contains("synthetic-secret"));
}

#[tokio::test]
async fn successful_google_reply_requires_an_object() {
    for body in [b"null".as_slice(), b"[]", b"42"] {
        assert!(response_json(response("200 OK", body).await).await.is_err());
    }
}

#[tokio::test]
async fn unknown_length_body_is_bounded_before_json_parsing() {
    let oversized = format!("{{\"payload\":\"{}\"}}", "x".repeat(10 * 1024 * 1024));
    assert!(
        response_json(response("200 OK", oversized.as_bytes()).await)
            .await
            .is_err()
    );
}
