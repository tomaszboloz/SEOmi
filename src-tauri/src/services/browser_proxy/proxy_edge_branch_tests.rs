use super::parse::*;
use super::server::*;
use crate::utils::test_io::Packets;
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::Duration;

#[tokio::test]
async fn test_server_connect_client_write_error() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        serve_connection_with(
            stream,
            |_, _| async { TcpStream::connect("127.0.0.1:0").await },
            Duration::from_millis(500),
            Duration::from_millis(500),
        )
        .await;
    });
    let mut client = TcpStream::connect(addr).await.unwrap();
    client
        .write_all(b"CONNECT 127.0.0.1:443 HTTP/1.1\r\n\r\n")
        .await
        .unwrap();
    drop(client);
    let _ = handle.await;
}

#[tokio::test]
async fn test_server_http_upstream_write_error() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        serve_connection_with(
            stream,
            |_, _| async { Err(io::Error::other("fail")) },
            Duration::from_millis(500),
            Duration::from_millis(500),
        )
        .await;
    });
    let mut client = TcpStream::connect(addr).await.unwrap();
    client
        .write_all(b"GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n")
        .await
        .unwrap();
    let mut buf = Vec::new();
    let _ = tokio::time::timeout(Duration::from_secs(1), client.read_to_end(&mut buf)).await;
    let _ = handle.await;
}

#[tokio::test]
async fn test_parse_edge_branches() {
    let mut reader = Packets(
        [Ok(
            b"GET http://example.test/ HTTP/1.1\r\n\xff\r\n\r\n".to_vec()
        )]
        .into(),
    );
    assert_eq!(read_request(&mut reader).await.err(), Some(400));

    let mut reader2 = Packets(
        [Ok(
            b"GET http://example.test/ HTTP/1.1\r\nContent-Length: 5\r\nContent-Length: 5\r\n\r\n"
                .to_vec(),
        )]
        .into(),
    );
    assert_eq!(read_request(&mut reader2).await.err(), Some(400));

    let mut reader3 = Packets(
        [Ok(
            b"GET http://example.test/ HTTP/1.1\r\nContent-Length: abc\r\n\r\n".to_vec(),
        )]
        .into(),
    );
    assert_eq!(read_request(&mut reader3).await.err(), Some(400));

    let mut reader4 = Packets(
        [Ok(
            b"GET http://example.test/ HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n".to_vec(),
        )]
        .into(),
    );
    assert_eq!(read_request(&mut reader4).await.err(), Some(400));
}
