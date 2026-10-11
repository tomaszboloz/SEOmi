use super::{
    models::{RenderWorkerRequest, WorkerShared},
    server::handle_connection_with,
};
use crate::commands::rendered_crawler::RenderedPageSnapshot;
use crate::utils::test_app::StorageApp;
use std::{sync::Arc, time::Duration};
use tauri::test::mock_builder;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::Mutex,
    time::Instant,
};

async fn send_mock_render(body: &str, giant: bool) -> String {
    let app = StorageApp::new(mock_builder());
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("secret".into()))),
        expires_at: Instant::now() + Duration::from_secs(60),
        expires_at_text: "2026-12-31T00:00:00Z".into(),
    };
    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        handle_connection_with(stream, shared, move |req: RenderWorkerRequest| async move {
            let html = if giant {
                "x".repeat(9 * 1024 * 1024)
            } else {
                "<html></html>".into()
            };
            Ok(RenderedPageSnapshot {
                requested_url: req.url,
                final_url: "https://example.test".into(),
                http_status: Some(200),
                content_type: "text/html".into(),
                charset: "utf-8".into(),
                html,
                html_truncated: false,
                navigation_time_ms: Some(10),
                lcp_ms: None,
                inp_ms: None,
                cls: None,
                failed_resource_urls: vec![],
                console_errors: vec![],
            })
        })
        .await
        .unwrap();
    });
    let mut stream = TcpStream::connect(address).await.unwrap();
    let raw = format!(
        "POST /v1/render HTTP/1.1\r\nHost: localhost\r\nx-seomi-worker-version: 1\r\nAuthorization: Bearer secret\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(raw.as_bytes()).await.unwrap();
    stream.shutdown().await.unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    server.await.unwrap();
    response
}

#[tokio::test]
async fn handle_connection_handles_successful_and_oversized_snapshots() {
    let ok = send_mock_render(r#"{"url":"https://example.test"}"#, false).await;
    assert!(ok.starts_with("HTTP/1.1 200 OK"));
    assert!(ok.contains(r#""finalUrl":"https://example.test""#));

    let oversized = send_mock_render(r#"{"url":"https://example.test"}"#, true).await;
    assert!(oversized.starts_with("HTTP/1.1 413 Payload Too Large"));
    assert!(oversized.contains("exceeds the response safety limit"));
}
