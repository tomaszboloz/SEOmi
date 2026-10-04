use super::*;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn fetch(status: u16, headers: &[u8], body: Vec<u8>, kind: &str) -> CrawledResource {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}/resource", listener.local_addr().unwrap());
    let mut response = format!("HTTP/1.1 {status} Fixture\r\n").into_bytes();
    response.extend_from_slice(headers);
    response.extend_from_slice(b"Connection: close\r\n\r\n");
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut buffer = [0; 1024];
        loop {
            let count = socket.read(&mut buffer).await.unwrap();
            assert!(count > 0);
            request.extend_from_slice(&buffer[..count]);
            if request.windows(4).any(|part| part == b"\r\n\r\n") {
                break;
            }
        }
        assert!(request.starts_with(b"GET /resource HTTP/1.1\r\n"));
        if socket.write_all(&response).await.is_ok() {
            for chunk in body.chunks(65_536) {
                if socket.write_all(chunk).await.is_err() {
                    break;
                }
            }
        }
    });
    let client = reqwest::Client::builder()
        .no_proxy()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap();
    let result = fetch_resource_candidate(
        client,
        ResourceCandidate {
            url: endpoint.clone(),
            resource_type: kind.into(),
            source_urls: vec!["https://example.test/source".into()],
        },
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.url, endpoint);
    assert_eq!(result.resource_type, kind);
    assert_eq!(result.source_urls, vec!["https://example.test/source"]);
    assert!(result.response_time_ms.is_some());
    result
}

fn png() -> Vec<u8> {
    let mut bytes = vec![137, 80, 78, 71, 13, 10, 26, 10];
    bytes.extend_from_slice(&[0; 8]);
    bytes.extend_from_slice(&640u32.to_be_bytes());
    bytes.extend_from_slice(&480u32.to_be_bytes());
    bytes
}

fn assert_unknown_dimensions(result: &CrawledResource) {
    assert_eq!(result.intrinsic_width, None);
    assert_eq!(result.intrinsic_height, None);
    assert_eq!(result.dimensions_source, None);
}

mod failures;
mod limits;
mod responses;
