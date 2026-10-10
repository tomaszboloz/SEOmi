use super::{
    check_external_crawl_links, command_tests::fixture as app_fixture, network::client_for_url,
    request::check_with,
};
use std::sync::{Arc, Mutex};
use tauri::Listener;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[tokio::test]
async fn failed_501_fallback_get_is_reported_without_status() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = [0u8; 1024];
        let _ = stream.read(&mut request).await.unwrap();
        stream
            .write_all(
                b"HTTP/1.1 501 Not Implemented\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        stream.shutdown().await.unwrap();
    });
    let input = format!("http://seomi.test:{}/page", address.port());
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.url, input);
    assert_eq!(result.http_status, None);
    assert!(result.request_error_kind.is_some());
}

#[tokio::test]
async fn fallback_get_supports_redirect_with_location_header() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream1, _) = listener.accept().await.unwrap();
        let mut req1 = [0u8; 1024];
        let _ = stream1.read(&mut req1).await.unwrap();
        stream1
            .write_all(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        let (mut stream2, _) = listener.accept().await.unwrap();
        let mut req2 = [0u8; 1024];
        let _ = stream2.read(&mut req2).await.unwrap();
        stream2
            .write_all(b"HTTP/1.1 302 Found\r\nLocation: /redirected\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        let (mut stream3, _) = listener.accept().await.unwrap();
        let mut req3 = [0u8; 1024];
        let _ = stream3.read(&mut req3).await.unwrap();
        stream3
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
    });
    let input = format!("http://seomi.test:{}/fallback-redirect", address.port());
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.http_status, Some(200));
    assert_eq!(
        result.redirect_url.as_deref(),
        Some(&format!("http://seomi.test:{}/redirected", address.port())[..])
    );
}

#[tokio::test]
async fn mixed_batch_handles_valid_blocked_invalid_and_duplicate_urls() {
    let app = app_fixture();
    let events = Arc::new(Mutex::new(Vec::new()));
    let received = events.clone();
    app.app.listen("crawl-external-link-progress", move |_| {
        received.lock().unwrap().push(());
    });

    let targets = vec![
        "ftp://invalid-scheme.test".to_string(),
        "http://127.0.0.1/private".to_string(),
        "http://192.168.1.1/blocked".to_string(),
        "https://user:pass@example.com/creds".to_string(),
        "http://127.0.0.1/private".to_string(), // duplicate
        "   ".to_string(),                      // whitespace
    ];
    let batch = check_external_crawl_links(app.handle(), "mixed-batch".into(), targets, Some(10))
        .await
        .unwrap();

    assert_eq!(batch.requested, 4);
    assert_eq!(batch.checked, 4);
    assert_eq!(batch.omitted, 0);
    assert_eq!(batch.results.len(), 4);
    assert!(events.lock().unwrap().len() >= 4);

    for result in &batch.results {
        assert!(result.request_error_kind.is_some());
        assert_eq!(result.http_status, None);
    }
}
