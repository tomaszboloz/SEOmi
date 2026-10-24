use super::{types::MAX_CONCURRENT_CONNECTIONS, BrowserRequestProxy};
use tokio::{
    io::AsyncWriteExt,
    net::TcpStream,
    sync::watch,
    time::{timeout, Duration},
};

#[path = "runtime_fixture.rs"]
mod runtime_fixture;
#[path = "runtime_framing_tests.rs"]
mod runtime_framing_tests;
use runtime_fixture::request;

#[tokio::test]
async fn proxy_public_lifecycle_binds_loopback_and_stops_after_rejecting_unsafe_routes() {
    let proxy = BrowserRequestProxy::start().await.unwrap();
    let url = proxy.url();
    assert_eq!(url.scheme(), "http");
    assert_eq!(url.host_str(), Some("127.0.0.1"));
    assert_eq!(url.port(), Some(proxy.address.port()));
    assert!(!proxy.task.as_ref().unwrap().is_finished());
    for (request_bytes, status) in [
        (&b"broken\r\n\r\n"[..], 400),
        (&b"POST http://example.test/ HTTP/1.1\r\n\r\n"[..], 405),
        (&b"GET http://localhost/ HTTP/1.1\r\n\r\n"[..], 403),
        (&b"GET http://127.0.0.1/ HTTP/1.1\r\n\r\n"[..], 403),
        (&b"GET http://example.test:22/ HTTP/1.1\r\n\r\n"[..], 403),
        (&b"CONNECT localhost:443 HTTP/1.1\r\n\r\n"[..], 403),
        (&b"CONNECT example.test:22 HTTP/1.1\r\n\r\n"[..], 403),
    ] {
        let response = request(&proxy, request_bytes).await;
        assert!(response.starts_with(format!("HTTP/1.1 {status} ").as_bytes()));
        assert!(response
            .windows(b"Connection: close".len())
            .any(|bytes| bytes == b"Connection: close"));
    }
    let address = proxy.address;
    proxy.stop().await;
    assert!(TcpStream::connect(address).await.is_err());
}

#[tokio::test]
async fn dropping_proxy_aborts_listener_and_closes_an_accepted_partial_request() {
    let proxy = BrowserRequestProxy::start().await.unwrap();
    let mut stream = TcpStream::connect(proxy.address).await.unwrap();
    stream.write_all(b"GET").await.unwrap();
    let address = proxy.address;
    let task = proxy.task.as_ref().unwrap().abort_handle();
    assert!(request(&proxy, b"invalid\r\n\r\n")
        .await
        .starts_with(b"HTTP/1.1 400"));
    drop(proxy);
    timeout(Duration::from_secs(5), async {
        while !task.is_finished() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    assert!(TcpStream::connect(address).await.is_err());
    let mut response = Vec::new();
    let closed = timeout(
        Duration::from_secs(5),
        tokio::io::AsyncReadExt::read_to_end(&mut stream, &mut response),
    )
    .await
    .unwrap();
    assert!(closed.is_ok() || closed.unwrap_err().kind() == std::io::ErrorKind::ConnectionReset);
}

#[tokio::test]
async fn proxy_rejects_connections_after_the_permit_pool_is_full() {
    let proxy = BrowserRequestProxy::start().await.unwrap();
    let mut held = Vec::new();
    for _ in 0..MAX_CONCURRENT_CONNECTIONS {
        let mut stream = TcpStream::connect(proxy.address).await.unwrap();
        stream.write_all(b"GET").await.unwrap();
        held.push(stream);
        tokio::task::yield_now().await;
    }
    let response = request(&proxy, b"").await;
    assert!(response.starts_with(b"HTTP/1.1 503 Service Unavailable\r\n"));
    assert!(response
        .windows(b"Connection: close".len())
        .any(|bytes| bytes == b"Connection: close"));
    assert!(response
        .windows(b"Content-Length: 30".len())
        .any(|bytes| bytes == b"Content-Length: 30"));
    assert!(response.ends_with(b"Proxy connection limit reached"));
    drop(held);
    proxy.stop().await;
}

#[tokio::test]
async fn lifecycle_methods_cover_absent_handles_and_join_errors() {
    let proxy = BrowserRequestProxy {
        address: "127.0.0.1:0".parse().unwrap(),
        shutdown: None,
        task: None,
    };
    proxy.stop().await;
    let proxy = BrowserRequestProxy {
        address: "127.0.0.1:0".parse().unwrap(),
        shutdown: None,
        task: None,
    };
    drop(proxy);

    let (shutdown, receiver) = watch::channel(false);
    drop(receiver);
    let task = tokio::spawn(async { std::future::pending::<()>().await });
    task.abort();
    BrowserRequestProxy {
        address: "127.0.0.1:0".parse().unwrap(),
        shutdown: Some(shutdown),
        task: Some(task),
    }
    .stop()
    .await;
}

#[tokio::test]
async fn dropping_the_shutdown_sender_ends_the_listener_loop() {
    let mut proxy = BrowserRequestProxy::start().await.unwrap();
    let task = proxy.task.as_ref().unwrap().abort_handle();
    proxy.shutdown.take();
    timeout(Duration::from_secs(2), async {
        while !task.is_finished() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}
