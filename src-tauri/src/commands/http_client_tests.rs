use super::check_link;
use crate::services::http_client::status::check_status_with_resolver;
use std::{net::SocketAddr, time::Duration};
use tokio::{io::AsyncReadExt, io::AsyncWriteExt, net::TcpListener};
use url::Url;

#[tokio::test]
async fn link_status_rejects_local_and_credential_urls_before_network() {
    for url in [
        "http://127.0.0.1/private",
        "https://user:password@example.com/secret",
        "file:///tmp/report.html",
    ] {
        let error = check_link(url.into(), Some(999)).await.unwrap_err();
        assert!(error.starts_with("Invalid link URL:"), "{error}");
    }
}

#[tokio::test]
async fn link_status_checks_local_fixture_through_the_validated_resolver() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = [0; 1024];
        let bytes = stream.read(&mut request).await.unwrap();
        assert!(bytes > 0, "fixture must receive the HTTP request");
        stream
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
    });
    let url = Url::parse("http://fixture.test/").unwrap();
    let result = check_status_with_resolver(&url, Duration::from_secs(1), move |_url| async move {
        Ok::<Vec<SocketAddr>, anyhow::Error>(vec![address])
    })
    .await
    .unwrap();
    server.await.unwrap();
    assert_eq!(result.0, 204);
}
