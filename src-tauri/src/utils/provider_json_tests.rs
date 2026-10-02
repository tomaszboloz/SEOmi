use super::read_provider_json;
use serde_json::json;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn reply(status: &str, body: &[u8], known_length: bool) -> reqwest::Response {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let length = if known_length {
        format!("Content-Length: {}\r\n", body.len())
    } else {
        String::new()
    };
    let header = format!("HTTP/1.1 {status}\r\n{length}Connection: close\r\n\r\n");
    let body = body.to_vec();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0; 4096];
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
async fn exact_byte_boundary_preserves_zero_null_and_unicode_without_length_dependence() {
    let bytes = "{\"value\":\"żółć\",\"zero\":0,\"missing\":null}".as_bytes();
    for known_length in [true, false] {
        let response = reply("200 OK", bytes, known_length).await;
        assert_eq!(
            read_provider_json(response, bytes.len(), "Fixture")
                .await
                .unwrap(),
            json!({"value":"żółć","zero":0,"missing":null})
        );
        let response = reply("200 OK", bytes, known_length).await;
        assert!(read_provider_json(response, bytes.len() - 1, "Fixture")
            .await
            .unwrap_err()
            .contains("safety limit"));
    }
}

#[tokio::test]
async fn zero_budget_and_malformed_or_non_object_successes_are_rejected() {
    assert!(
        read_provider_json(reply("200 OK", b"{}", false).await, 0, "Fixture")
            .await
            .is_err()
    );
    for bytes in [
        b"not-json".as_slice(),
        b"null",
        b"[]",
        b"42",
        b"",
        b"{\"value\":\"\xff\"}",
    ] {
        assert_eq!(
            read_provider_json(reply("200 OK", bytes, false).await, 100, "Fixture")
                .await
                .unwrap_err(),
            "Fixture returned an invalid response."
        );
    }
}

#[tokio::test]
async fn failed_http_never_interpolates_provider_text_even_if_invalid_json() {
    for bytes in [
        b"private-provider-text".as_slice(),
        br#"{"error":{"message":"secret"}}"#,
    ] {
        let error = read_provider_json(
            reply("429 Too Many Requests", bytes, false).await,
            100,
            "Fixture",
        )
        .await
        .unwrap_err();
        assert_eq!(error, "Fixture HTTP 429 Too Many Requests: request failed.");
    }
}

#[tokio::test]
async fn truncated_transport_errors_do_not_include_the_url_or_raw_io_details() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!(
        "http://{}/?key=synthetic-secret",
        listener.local_addr().unwrap()
    );
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0; 4096];
        assert!(socket.read(&mut request).await.unwrap() > 0);
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{}")
            .await
            .unwrap();
    });
    let response = reqwest::Client::builder()
        .no_proxy()
        .build()
        .unwrap()
        .get(endpoint)
        .send()
        .await
        .unwrap();
    assert_eq!(
        read_provider_json(response, 100, "Fixture")
            .await
            .unwrap_err(),
        "Fixture response could not be read."
    );
}
