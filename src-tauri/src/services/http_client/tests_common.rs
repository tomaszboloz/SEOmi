use super::models::FetchOptions;
use std::net::SocketAddr;
use std::time::Duration;

#[allow(dead_code)]
pub fn options(limit: usize, redirects: usize) -> FetchOptions {
    FetchOptions {
        timeout: Duration::from_millis(250),
        max_redirects: redirects,
        verify_ssl: true,
        max_body_bytes: limit,
    }
}

#[allow(dead_code)]
pub async fn fixture(responses: Vec<String>) -> SocketAddr {
    fixture_bytes(responses.into_iter().map(String::into_bytes).collect()).await
}

#[allow(dead_code)]
pub async fn fixture_bytes(responses: Vec<Vec<u8>>) -> SocketAddr {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move {
        for response in responses {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = vec![0; 4096];
            let _ = stream.read(&mut request).await;
            let _ = stream.write_all(&response).await;
        }
    });
    address
}
