use super::{read_callback_request, write_callback_response, MAX_CALLBACK_HEADER_BYTES};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::Duration,
};

async fn pair() -> (TcpStream, TcpStream) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let client = TcpStream::connect(listener.local_addr().unwrap())
        .await
        .unwrap();
    let (server, _) = listener.accept().await.unwrap();
    (client, server)
}

#[tokio::test]
async fn read_callback_request_happy_path() {
    let (mut client, mut server) = pair().await;
    let request = "GET /oauth/callback?code=valid-code HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    let writer = tokio::spawn(async move {
        client.write_all(request.as_bytes()).await.unwrap();
    });
    let result = read_callback_request(&mut server, Duration::from_secs(1))
        .await
        .unwrap();
    assert_eq!(result, request);
    writer.await.unwrap();
}

#[tokio::test]
async fn read_callback_request_incomplete_request() {
    let (mut client, mut server) = pair().await;
    client
        .write_all(b"GET /oauth/callback HTTP/1.1\r\n")
        .await
        .unwrap();
    client.shutdown().await.unwrap();
    let err = read_callback_request(&mut server, Duration::from_secs(1))
        .await
        .unwrap_err();
    assert_eq!(err, "Incomplete OAuth callback request.");
}

#[tokio::test]
async fn read_callback_request_timeout() {
    let (_client, mut server) = pair().await;
    let err = read_callback_request(&mut server, Duration::from_millis(20))
        .await
        .unwrap_err();
    assert_eq!(err, "OAuth callback request timed out.");
}

#[tokio::test]
async fn read_callback_request_headers_overflow() {
    for bytes in [vec![b'x'; MAX_CALLBACK_HEADER_BYTES], {
        let mut b = vec![b'x'; MAX_CALLBACK_HEADER_BYTES - 3];
        b.extend_from_slice(b"\r\n\r\n");
        b
    }] {
        let (mut client, mut server) = pair().await;
        let writer = tokio::spawn(async move {
            let _ = client.write_all(&bytes).await;
        });
        let err = read_callback_request(&mut server, Duration::from_secs(1))
            .await
            .unwrap_err();
        assert_eq!(err, "OAuth callback headers exceed the limit.");
        writer.await.unwrap();
    }
}

#[tokio::test]
async fn read_callback_request_invalid_utf8() {
    let (mut client, mut server) = pair().await;
    let writer = tokio::spawn(async move {
        client.write_all(b"\xff\r\n\r\n").await.unwrap();
    });
    let err = read_callback_request(&mut server, Duration::from_secs(1))
        .await
        .unwrap_err();
    assert_eq!(err, "Invalid OAuth callback encoding.");
    writer.await.unwrap();
}

#[tokio::test]
async fn read_callback_request_connection_reset() {
    let (client, mut server) = pair().await;
    server.write_all(b"data-pending-read").await.unwrap();
    tokio::time::sleep(Duration::from_millis(20)).await;
    drop(client);
    tokio::time::sleep(Duration::from_millis(20)).await;
    let err = read_callback_request(&mut server, Duration::from_secs(1))
        .await
        .unwrap_err();
    assert!(err.starts_with("Unable to read the OAuth response:"));
}

#[tokio::test]
async fn write_callback_response_success() {
    let (mut client, mut server) = pair().await;
    write_callback_response(&mut server, "200 OK", "Success")
        .await
        .unwrap();
    drop(server);
    let mut response = String::new();
    client.read_to_string(&mut response).await.unwrap();
    assert!(response.starts_with("HTTP/1.1 200 OK"));
    assert!(response.contains("<p>Success</p>"));
    assert!(response.contains("Cache-Control: no-store"));
    assert!(response.contains(&format!(
        "Content-Length: {}",
        "<!doctype html><meta charset=\"utf-8\"><title>SEOmi</title><p>Success</p>".len()
    )));
}
