use super::*;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn raw_response(header: &[u8]) -> reqwest::Response {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let mut bytes = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n".to_vec();
    bytes.extend_from_slice(header);
    bytes.extend_from_slice(b"Connection: close\r\n\r\nok");
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0; 1024];
        let _ = socket.read(&mut request).await;
        let _ = socket.write_all(&bytes).await;
    });
    reqwest::Client::builder()
        .no_proxy()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .build()
        .unwrap()
        .get(endpoint)
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn non_utf8_last_modified_header_is_ignored_without_losing_the_body() {
    let response = raw_response(b"Last-Modified: \xff\r\n").await;
    let data = read_fetched_page_data(FetchedPageBody::Http(response), 16).await;
    assert_eq!(data.body, b"ok");
    assert!(data.last_modified.is_none());
}
