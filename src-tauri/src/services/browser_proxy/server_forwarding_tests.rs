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

async fn run_proxy_call<F, Fut>(request: &[u8], connector: F) -> Vec<u8>
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
            Duration::from_secs(1),
            Duration::from_secs(1),
        )
        .await;
    });
    let mut client = TcpStream::connect(address).await.unwrap();
    client.write_all(request).await.unwrap();
    client.shutdown().await.unwrap();
    let mut response = Vec::new();
    timeout(Duration::from_secs(2), client.read_to_end(&mut response))
        .await
        .expect("proxy response must finish within the deadline")
        .expect("proxy response must be readable");
    task.await.unwrap();
    response
}

#[tokio::test]
async fn connect_tunnels_via_port_8443() {
    let (upstream, fixture) = tunnel_fixture(b"tunnel-8443-ok").await;
    let response = run_proxy_call(
        b"CONNECT public.test:8443 HTTP/1.1\r\n\r\n",
        move |host, port| async move {
            assert_eq!((host.as_str(), port), ("public.test", 8443));
            TcpStream::connect(upstream).await
        },
    )
    .await;
    fixture.await.unwrap();
    assert_eq!(
        response,
        b"HTTP/1.1 200 Connection Established\r\n\r\ntunnel-8443-ok"
    );
}

#[tokio::test]
async fn connect_rejects_disallowed_ports() {
    let response = run_proxy_call(b"CONNECT public.test:80 HTTP/1.1\r\n\r\n", |_, _| async {
        unreachable!()
    })
    .await;
    assert!(response.starts_with(b"HTTP/1.1 403 Forbidden"));
    assert!(response
        .windows(29)
        .any(|w| w == b"Only public HTTPS tunnels are"));
}

#[tokio::test]
async fn http_rejects_disallowed_plain_http_ports() {
    let response = run_proxy_call(
        b"GET http://public.test:22/ HTTP/1.1\r\n\r\n",
        |_, _| async { unreachable!() },
    )
    .await;
    assert!(response.starts_with(b"HTTP/1.1 403 Forbidden"));
    assert!(response
        .windows(25)
        .any(|w| w == b"Only public web ports are"));
}

#[tokio::test]
async fn http_forwards_headers_and_strips_proxy_headers() {
    let (upstream, fixture) = response_fixture(b"HTTP/1.1 200 OK\r\n\r\nhello").await;
    let request = b"GET http://public.test/api HTTP/1.1\r\nProxy-Connection: keep-alive\r\nProxy-Authorization: basic secret\r\nHost: public.test\r\nX-Custom: allowed\r\nContent-Length: 0\r\n\r\n";
    let response = run_proxy_call(request, move |host, port| async move {
        assert_eq!((host.as_str(), port), ("public.test", 80));
        TcpStream::connect(upstream).await
    })
    .await;
    let sent = timeout(Duration::from_secs(2), fixture)
        .await
        .expect("upstream must receive the forwarded request")
        .unwrap();
    assert!(sent.starts_with(b"GET /api HTTP/1.1\r\n"));
    assert!(sent.windows(17).any(|w| w == b"X-Custom: allowed"));
    assert!(!sent.windows(16).any(|w| w == b"Proxy-Connection"));
    assert!(!sent.windows(19).any(|w| w == b"Proxy-Authorization"));
    assert!(sent.ends_with(b"Connection: close\r\n\r\n"));
    assert_eq!(response, b"HTTP/1.1 200 OK\r\n\r\nhello");
}

#[tokio::test]
async fn mutation_methods_and_request_bodies_never_connect_to_upstream() {
    for (request, status) in [
        (
            b"POST http://public.test/api HTTP/1.1\r\n\r\n".as_slice(),
            "405",
        ),
        (
            b"GET http://public.test/api HTTP/1.1\r\nContent-Length: 4\r\n\r\ndata".as_slice(),
            "400",
        ),
    ] {
        let response = run_proxy_call(request, |_, _| async {
            panic!("rejected requests must not reach the connector")
        })
        .await;
        assert!(response.starts_with(format!("HTTP/1.1 {status}").as_bytes()));
    }
}
