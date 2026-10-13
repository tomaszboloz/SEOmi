use super::super::{admin::discover_at, collect_at, models::Ga4Status};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn dispatch(
    count: usize,
    mut responder: impl FnMut(&str) -> String + Send + 'static,
) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        for _ in 0..count {
            if let Ok((mut stream, _)) = listener.accept().await {
                let req = super::http_fixture::read_request(&mut stream).await;
                let body = responder(&req.path);
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(head.as_bytes()).await.unwrap();
                stream.shutdown().await.unwrap();
            }
        }
    });
    (addr, handle)
}

#[tokio::test]
async fn discover_and_collect_validation_shortcuts() {
    let client = super::http_fixture::test_client();
    let unused = "http://127.0.0.1:1";
    let err = discover_at(&client, "", "https://example.com", unused, unused)
        .await
        .unwrap_err();
    assert_eq!(err, "Google Analytics access token is missing.");

    let err = collect_at(
        &client,
        "tok",
        "https://example.com",
        "2026-01-05",
        "2026-01-02",
        unused,
        unused,
        unused,
    )
    .await
    .unwrap_err();
    assert_eq!(err, "Google Analytics date range is invalid.");
}

#[tokio::test]
async fn collect_at_discovery_multiple_matching_streams_yields_partial() {
    let (addr, handle) = dispatch(3, |path| {
        let route = path.split('?').next().unwrap_or(path);
        if route.ends_with("/accountsummaries") {
            r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/1"},{"property":"properties/2"}]}]}"#.into()
        } else {
            r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}]}"#.into()
        }
    }).await;

    let client = super::http_fixture::test_client();
    let snapshot = collect_at(
        &client,
        "tok",
        "https://example.com",
        "2026-01-01",
        "2026-01-02",
        &format!("{addr}/accountSummaries"),
        &addr,
        &addr,
    )
    .await
    .unwrap();
    assert_eq!(snapshot.status, Ga4Status::Partial);
    assert!(snapshot.discovery.property.is_none());
    assert!(snapshot.report.is_none());
    handle.await.unwrap();
}

#[tokio::test]
async fn collect_at_report_missing_status() {
    let (addr, handle) = dispatch(3, |path| {
        let route = path.split('?').next().unwrap_or(path);
        if route.ends_with("/accountsummaries") {
            r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/1"}]}]}"#.into()
        } else if route.contains("/datastreams") {
            r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}]}"#.into()
        } else {
            r#"{"rowCount":0,"rows":[]}"#.into()
        }
    })
    .await;

    let client = super::http_fixture::test_client();
    let snapshot = collect_at(
        &client,
        "tok",
        "https://example.com",
        "2026-01-01",
        "2026-01-02",
        &format!("{addr}/accountSummaries"),
        &addr,
        &addr,
    )
    .await
    .unwrap();
    assert_eq!(snapshot.status, Ga4Status::Missing);
    handle.await.unwrap();
}
