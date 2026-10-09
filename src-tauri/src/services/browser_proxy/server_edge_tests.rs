use super::server::{serve_connection, serve_connection_with};
use std::{future::Future, io, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

async fn send_and_read<F, Fut>(request: &[u8], connector: F) -> Vec<u8>
where
    F: Fn(String, u16) -> Fut + Send + Copy + 'static,
    Fut: Future<Output = io::Result<TcpStream>> + Send + 'static,
{
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        serve_connection_with(
            stream,
            connector,
            Duration::from_millis(500),
            Duration::from_millis(500),
        )
        .await;
    });

    let mut client = TcpStream::connect(address).await.unwrap();
    client.write_all(request).await.unwrap();
    client.shutdown().await.unwrap();

    let mut response = Vec::new();
    timeout(Duration::from_secs(2), client.read_to_end(&mut response))
        .await
        .unwrap()
        .unwrap();
    task.await.unwrap();
    response
}

#[tokio::test]
async fn connect_rejects_non_https_port_and_unverified_destinations() {
    let response_non_https =
        send_and_read(b"CONNECT example.com:80 HTTP/1.1\r\n\r\n", |_, _| async {
            panic!("must not connect")
        })
        .await;
    assert!(response_non_https.starts_with(b"HTTP/1.1 403 Forbidden"));
    assert!(String::from_utf8_lossy(&response_non_https)
        .contains("Only public HTTPS tunnels are allowed"));

    let response_connect_err =
        send_and_read(b"CONNECT example.com:443 HTTP/1.1\r\n\r\n", |_, _| async {
            Err(io::Error::new(io::ErrorKind::ConnectionRefused, "blocked"))
        })
        .await;
    assert!(response_connect_err.starts_with(b"HTTP/1.1 403 Forbidden"));
    assert!(String::from_utf8_lossy(&response_connect_err)
        .contains("Destination is not a verified public host"));
}

#[tokio::test]
async fn http_rejects_disallowed_ports_and_unverified_destinations() {
    let response_bad_port = send_and_read(
        b"GET http://example.com:22/ HTTP/1.1\r\nHost: example.com\r\n\r\n",
        |_, _| async { panic!("must not connect") },
    )
    .await;
    assert!(response_bad_port.starts_with(b"HTTP/1.1 403 Forbidden"));
    assert!(
        String::from_utf8_lossy(&response_bad_port).contains("Only public web ports are allowed")
    );

    let response_http_err = send_and_read(
        b"GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n",
        |_, _| async { Err(io::Error::new(io::ErrorKind::ConnectionRefused, "blocked")) },
    )
    .await;
    assert!(response_http_err.starts_with(b"HTTP/1.1 403 Forbidden"));
    assert!(String::from_utf8_lossy(&response_http_err)
        .contains("Destination is not a verified public host"));
}

#[tokio::test]
async fn serve_connection_handles_incoming_stream_directly() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        serve_connection(stream).await;
    });

    let mut client = TcpStream::connect(address).await.unwrap();
    client.write_all(b"INVALID REQUEST\r\n\r\n").await.unwrap();
    client.shutdown().await.unwrap();

    let mut response = Vec::new();
    let _ = timeout(Duration::from_secs(2), client.read_to_end(&mut response)).await;
    task.await.unwrap();
    assert!(response.starts_with(b"HTTP/1.1 400 Bad Request"));
}
