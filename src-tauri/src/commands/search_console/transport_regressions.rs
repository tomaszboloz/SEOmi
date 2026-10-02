use super::{callback::receive_oauth_code, tokens::token_json};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::{timeout, Duration},
};

#[tokio::test]
async fn google_http_errors_preserve_the_provider_message() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = [0; 4096];
        let count = stream.read(&mut request).await.unwrap();
        assert!(count > 0);
        let body = r#"{"error":{"message":"Insufficient Search Console property permissions"}}"#;
        let response = format!(
            "HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(response.as_bytes()).await.unwrap();
    });
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let result = token_json("fixture-token", client.get(format!("http://{address}"))).await;
    server.await.unwrap();
    assert!(result
        .unwrap_err()
        .contains("Insufficient Search Console property permissions"));
}

#[tokio::test]
async fn oauth_callback_accepts_a_request_line_split_across_tcp_reads() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let mut callback =
        tokio::spawn(async move { receive_oauth_code(listener, "state-fixture").await });
    let mut stream = TcpStream::connect(address).await.unwrap();
    stream
        .write_all(b"GET /oauth2callback?state=state-")
        .await
        .unwrap();
    // Exercise a genuinely fragmented stream, not a mocked complete request.
    tokio::time::sleep(Duration::from_millis(30)).await;
    let _ = stream
        .write_all(b"fixture&code=accepted-code HTTP/1.1\r\nHost: localhost\r\n\r\n")
        .await;
    let mut response = Vec::new();
    timeout(Duration::from_secs(1), stream.read_to_end(&mut response))
        .await
        .unwrap()
        .unwrap();
    let result = timeout(Duration::from_secs(1), &mut callback).await;
    callback.abort();
    assert!(String::from_utf8_lossy(&response).starts_with("HTTP/1.1 200 OK"));
    assert_eq!(result.unwrap().unwrap().unwrap(), "accepted-code");
}
