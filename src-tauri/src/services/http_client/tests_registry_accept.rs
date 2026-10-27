use super::fetch::fetch_with_resolver_accept;
use super::tests_common::options;
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;

#[tokio::test]
async fn registry_transport_sends_json_accept_header() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut bytes = vec![0; 2048];
        let size = stream.read(&mut bytes).await.unwrap();
        let request = String::from_utf8_lossy(&bytes[..size]).to_ascii_lowercase();
        assert!(request.contains("accept: application/json"));
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
            .await
            .unwrap();
    });
    let url = Url::parse(&format!("http://fixture.test:{}/", address.port())).unwrap();
    let result = fetch_with_resolver_accept(
        &url,
        "Test",
        options(64, 0),
        Some("application/json"),
        move |_url: Url| async move { Ok::<Vec<SocketAddr>, anyhow::Error>(vec![address]) },
    )
    .await
    .unwrap();
    assert_eq!(result.body, "ok");
    server.await.unwrap();
}
