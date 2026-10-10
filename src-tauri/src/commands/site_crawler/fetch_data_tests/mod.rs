use super::*;
use crate::commands::rendered_crawler::RenderedPageSnapshot;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn response(headers: &str, body: &[u8]) -> reqwest::Response {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let header = format!("HTTP/1.1 200 OK\r\n{headers}Connection: close\r\n\r\n");
    let body = body.to_vec();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0; 4096];
        assert!(socket.read(&mut request).await.unwrap() > 0);
        if socket.write_all(header.as_bytes()).await.is_ok() {
            let _ = socket.write_all(&body).await;
        }
    });
    reqwest::Client::builder()
        .no_proxy()
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap()
        .get(endpoint)
        .send()
        .await
        .unwrap()
}

fn snapshot() -> RenderedPageSnapshot {
    RenderedPageSnapshot {
        requested_url: "https://example.test/old".into(),
        final_url: "https://example.test/".into(),
        http_status: None,
        content_type: "text/html".into(),
        charset: "UTF-8".into(),
        html: "<p>Żółć</p>".into(),
        html_truncated: false,
        navigation_time_ms: Some(0),
        lcp_ms: Some(125),
        inp_ms: Some(0),
        cls: Some(0.0),
        failed_resource_urls: vec!["https://example.test/missing.png".into()],
        console_errors: vec!["Synthetic diagnostic".into()],
    }
}

mod http;
mod http_edges;
mod rendered;
