use super::super::{collect_at, models::Ga4Status};
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
async fn collect_at_report_missing_and_partial_statuses() {
    let mut report_call = 0;
    let (addr, handle) = dispatch(4, move |path| {
        let route = path.split('?').next().unwrap_or(path);
        if route.ends_with("/accountsummaries") {
            r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/1"}]}]}"#.into()
        } else if route.contains("/datastreams") {
            r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}]}"#.into()
        } else {
            report_call += 1;
            if report_call == 1 {
                r#"{"rowCount":2,"rows":[{"dimensionValues":[{"value":"/"},{"value":"example.com"}],"metricValues":[{"value":"1"},{"value":"0"},{"value":"0"}]}]}"#.into()
            } else {
                r#"{"rowCount":2,"rows":[]}"#.into()
            }
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
    assert_eq!(snapshot.status, Ga4Status::Partial);
    handle.await.unwrap();
}

#[tokio::test]
async fn collect_at_discovery_partial_with_report_complete_yields_partial() {
    let mut stream_call = 0;
    let (addr, handle) = dispatch(4, move |path| {
        let route = path.split('?').next().unwrap_or(path);
        if route.ends_with("/accountsummaries") {
            r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/1"}]}]}"#.into()
        } else if route.contains("/datastreams") {
            stream_call += 1;
            if stream_call == 1 {
                r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}],"nextPageToken":"loop"}"#.into()
            } else {
                r#"{"dataStreams":[],"nextPageToken":"loop"}"#.into()
            }
        } else {
            r#"{"rowCount":1,"rows":[{"dimensionValues":[{"value":"/"},{"value":"example.com"}],"metricValues":[{"value":"1"},{"value":"0"},{"value":"0"}]}]}"#.into()
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
    assert_eq!(snapshot.discovery.status, Ga4Status::Partial);
    assert_eq!(
        snapshot.report.as_ref().unwrap().status,
        Ga4Status::Complete
    );
    assert_eq!(snapshot.status, Ga4Status::Partial);
    handle.await.unwrap();
}
