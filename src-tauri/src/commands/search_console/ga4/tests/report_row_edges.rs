use super::super::{models::Ga4Status, report::run_at};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn serve_once(status: u16, body: &'static str) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            let _ = super::http_fixture::read_request(&mut stream).await;
            let resp = format!(
                "HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(resp.as_bytes()).await.unwrap();
            stream.shutdown().await.unwrap();
        }
    });
    (addr, handle)
}

async fn serve_twice(
    first: &'static str,
    second: &'static str,
) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        for body in [first, second] {
            if let Ok((mut stream, _)) = listener.accept().await {
                let _ = super::http_fixture::read_request(&mut stream).await;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(resp.as_bytes()).await.unwrap();
                stream.shutdown().await.unwrap();
            }
        }
    });
    (addr, handle)
}

#[tokio::test]
async fn run_at_empty_rows_and_partial_rows() {
    let empty_body = r#"{"rowCount":0,"rows":[]}"#;
    let (addr, handle) = serve_once(200, empty_body).await;
    let client = super::http_fixture::test_client();
    let report = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await
    .unwrap();
    assert_eq!(report.status, Ga4Status::Missing);
    assert_eq!(report.rows.len(), 0);
    assert!(!report.may_be_truncated);
    handle.await.unwrap();

    let p1 = r#"{"rowCount":2,"rows":[{"dimensionValues":[{"value":"/"},{"value":"example.com"}],"metricValues":[{"value":"5"},{"value":"2"},{"value":"1"}]}]}"#;
    let p2 = r#"{"rowCount":2,"rows":[]}"#;
    let (addr, handle) = serve_twice(p1, p2).await;
    let report = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await
    .unwrap();
    assert_eq!(report.status, Ga4Status::Partial);
    assert_eq!(report.rows.len(), 1);
    assert!(report.may_be_truncated);
    handle.await.unwrap();
}

#[tokio::test]
async fn run_at_invalid_row_count() {
    let invalid_count_body = r#"{"rowCount":0,"rows":[{
        "dimensionValues":[{"value":"/"},{"value":"example.com"}],"metricValues":[{"value":"5"},{"value":"2"},{"value":"1"}]
    }]}"#;
    let (addr, handle) = serve_once(200, invalid_count_body).await;
    let client = super::http_fixture::test_client();
    let res = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await;
    assert_eq!(
        res.unwrap_err(),
        "Google Analytics returned an invalid report row count."
    );
    handle.await.unwrap();
}
