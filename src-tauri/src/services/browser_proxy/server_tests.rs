use super::{
    server::serve_connection_with,
    server_fixture::{response_fixture, tunnel_fixture},
};
use std::{future::Future, io, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

async fn run_proxy<F, Fut>(
    request: &[u8],
    connector: F,
    request_timeout: Duration,
    tunnel_timeout: Duration,
) -> Vec<u8>
where
    F: Fn(String, u16) -> Fut + Send + Copy + 'static,
    Fut: Future<Output = io::Result<TcpStream>> + Send + 'static,
{
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        serve_connection_with(stream, connector, request_timeout, tunnel_timeout).await;
    });
    let mut client = TcpStream::connect(address).await.unwrap();
    for chunk in request.chunks(7) {
        client.write_all(chunk).await.unwrap();
        tokio::task::yield_now().await;
    }
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
async fn http_forwarding_uses_local_fixture_and_filters_hop_by_hop_headers() {
    let (upstream, fixture) =
        response_fixture(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
            .await;
    let response = run_proxy(
        b"GET http://public.test:8080/path?q=1 HTTP/1.1\r\nHost: forged\r\nConnection: keep-alive\r\nProxy-Connection: keep-alive\r\nX-Test: yes\r\ncontent-length: 0\r\n\r\n",
        move |host, port| async move {
            assert_eq!((host.as_str(), port), ("public.test", 8080));
            TcpStream::connect(upstream).await
        },
        Duration::from_secs(1),
        Duration::from_secs(1),
    )
    .await;
    let forwarded = fixture.await.unwrap();
    assert_eq!(
        response,
        b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok"
    );
    assert_eq!(forwarded, b"GET /path?q=1 HTTP/1.1\r\nX-Test: yes\r\ncontent-length: 0\r\nHost: public.test:8080\r\nConnection: close\r\n\r\n");
}

#[tokio::test]
async fn connect_tunnels_to_local_fixture_and_returns_established_response() {
    let (upstream, fixture) = tunnel_fixture(b"tunnel-response").await;
    let response = run_proxy(
        b"CONNECT public.test:443 HTTP/1.1\r\n\r\n",
        move |host, port| async move {
            assert_eq!((host.as_str(), port), ("public.test", 443));
            TcpStream::connect(upstream).await
        },
        Duration::from_secs(1),
        Duration::from_secs(1),
    )
    .await;
    fixture.await.unwrap();
    assert_eq!(
        response,
        b"HTTP/1.1 200 Connection Established\r\n\r\ntunnel-response"
    );
}

#[tokio::test]
async fn request_and_upstream_timeouts_return_without_leaking_connections() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        serve_connection_with(
            stream,
            |_, _| async { Err(io::Error::other("unused connector")) },
            Duration::from_millis(10),
            Duration::from_millis(10),
        )
        .await;
    });
    let mut client = TcpStream::connect(address).await.unwrap();
    client.write_all(b"GET").await.unwrap();
    let mut response = Vec::new();
    timeout(Duration::from_secs(1), client.read_to_end(&mut response))
        .await
        .unwrap()
        .unwrap();
    task.await.unwrap();
    assert!(response.starts_with(b"HTTP/1.1 408 Request Timeout"));

    let upstream_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let upstream = upstream_listener.local_addr().unwrap();
    let hold = tokio::spawn(async move {
        let (_stream, _) = upstream_listener.accept().await.unwrap();
        tokio::time::sleep(Duration::from_secs(1)).await;
    });
    let response = run_proxy(
        b"GET http://public.test:8080/ HTTP/1.1\r\n\r\n",
        move |_, _| async move { TcpStream::connect(upstream).await },
        Duration::from_millis(10),
        Duration::from_millis(10),
    )
    .await;
    hold.abort();
    assert!(response.is_empty());
}
