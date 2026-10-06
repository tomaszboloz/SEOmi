use super::super::server_fixture::response_fixture;
use super::serve_connection_with;
use std::time::Duration;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

async fn forwarded_request(request: &[u8]) -> Vec<u8> {
    let (upstream, fixture) =
        response_fixture(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n").await;
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (client, _) = listener.accept().await.unwrap();
        serve_connection_with(
            client,
            move |_, _| async move { TcpStream::connect(upstream).await },
            Duration::from_secs(2),
            Duration::from_secs(2),
        )
        .await;
    });
    let mut client = TcpStream::connect(address).await.unwrap();
    client.write_all(request).await.unwrap();
    client.shutdown().await.unwrap();
    let mut response = Vec::new();
    timeout(Duration::from_secs(3), client.read_to_end(&mut response))
        .await
        .unwrap()
        .unwrap();
    assert!(response.starts_with(b"HTTP/1.1 200 OK"));
    task.await.unwrap();
    fixture.await.unwrap()
}

#[tokio::test]
async fn forwarding_removes_connection_options_and_standard_hop_headers() {
    let forwarded = forwarded_request(
        b"GET http://public.test/ HTTP/1.1\r\nConnection: keep-alive, X-Secret\r\nconnection: X-Other\r\nx-secret: sensitive\r\nX-Other: private\r\nKeep-Alive: timeout=5\r\nTE: trailers\r\nTrailer: X-Trailer\r\nUpgrade: websocket\r\nProxy-Authorization: Basic secret\r\nX-End-To-End: retained\r\nHost: forged\r\n\r\n",
    )
    .await;
    assert_eq!(
        forwarded,
        b"GET / HTTP/1.1\r\nX-End-To-End: retained\r\nHost: public.test\r\nConnection: close\r\n\r\n"
    );
}

#[tokio::test]
async fn head_forwarding_preserves_headers_not_named_as_connection_options() {
    let forwarded = forwarded_request(
        b"HEAD http://public.test:8080/a?q=1 HTTP/1.0\r\nConnection:  x-private \r\nX-Private: drop\r\nX-Private-Extra: keep\r\nAuthorization: Bearer origin\r\n\r\n",
    )
    .await;
    assert_eq!(
        forwarded,
        b"HEAD /a?q=1 HTTP/1.1\r\nX-Private-Extra: keep\r\nAuthorization: Bearer origin\r\nHost: public.test:8080\r\nConnection: close\r\n\r\n"
    );
}
