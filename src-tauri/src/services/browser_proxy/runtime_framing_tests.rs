use super::runtime_fixture::{is_complete_http_response, read_response};
use tokio::io::AsyncWriteExt;
use tokio::net::{TcpListener, TcpStream};

#[tokio::test]
async fn framing_rejects_complete_headers_with_truncated_body() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        socket
            .write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 30\r\n\r\nShort")
            .await
            .unwrap();
        socket.shutdown().await.unwrap();
    });
    let client = TcpStream::connect(addr).await.unwrap();
    let result = read_response(client).await;
    assert!(result.is_err(), "truncated body must be rejected as Err");
}

#[tokio::test]
async fn framing_rejects_headers_missing_or_invalid_content_length() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        socket
            .write_all(b"HTTP/1.1 503 Service Unavailable\r\n\r\nBodyWithoutLength")
            .await
            .unwrap();
        socket.shutdown().await.unwrap();
    });
    let client = TcpStream::connect(addr).await.unwrap();
    assert!(
        read_response(client).await.is_err(),
        "missing CL must be rejected"
    );

    let listener2 = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr2 = listener2.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut socket, _) = listener2.accept().await.unwrap();
        socket
            .write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: invalid\r\n\r\nBody")
            .await
            .unwrap();
        socket.shutdown().await.unwrap();
    });
    let client2 = TcpStream::connect(addr2).await.unwrap();
    assert!(
        read_response(client2).await.is_err(),
        "invalid CL must be rejected"
    );
}

#[tokio::test]
async fn framing_rejects_partial_headers_at_eof() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        socket
            .write_all(b"HTTP/1.1 503 Service Unav")
            .await
            .unwrap();
        socket.shutdown().await.unwrap();
    });
    let client = TcpStream::connect(addr).await.unwrap();
    assert!(
        read_response(client).await.is_err(),
        "partial headers must be rejected"
    );
}

#[tokio::test]
async fn framing_rejects_empty_eof() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        socket.shutdown().await.unwrap();
    });
    let client = TcpStream::connect(addr).await.unwrap();
    assert!(
        read_response(client).await.is_err(),
        "empty EOF must be rejected"
    );
}

#[tokio::test]
async fn framing_accepts_positive_fragmented_complete_503() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let payload = b"HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 30\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nProxy connection limit reached";
        for chunk in payload.chunks(13) {
            socket.write_all(chunk).await.unwrap();
            tokio::task::yield_now().await;
        }
        socket.shutdown().await.unwrap();
    });
    let client = TcpStream::connect(addr).await.unwrap();
    let result = read_response(client).await;
    assert!(result.is_ok(), "fragmented valid 503 must be accepted");
    let response = result.unwrap();
    assert!(is_complete_http_response(&response));
    assert!(response.starts_with(b"HTTP/1.1 503 Service Unavailable\r\n"));
    assert!(response.ends_with(b"Proxy connection limit reached"));
}
