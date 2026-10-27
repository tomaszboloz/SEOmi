use super::super::{account::account_candidates, report::run_at, validation::MAX_PAGES};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn serve(bodies: Vec<String>) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        for body in bodies {
            let (mut stream, _) = listener.accept().await.unwrap();
            let _ = super::http_fixture::read_request(&mut stream).await;
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(head.as_bytes()).await.unwrap();
            stream.shutdown().await.unwrap();
        }
    });
    (addr, handle)
}

#[tokio::test]
async fn account_candidates_reports_truncation_at_the_page_limit() {
    let bodies = (0..MAX_PAGES)
        .map(|page| format!(r#"{{"accountSummaries":[],"nextPageToken":"page-{page}"}}"#))
        .collect();
    let (addr, handle) = serve(bodies).await;
    let client = super::http_fixture::test_client();
    let (candidates, pages, truncated) = account_candidates(&client, "tok", &addr).await.unwrap();
    assert!(candidates.is_empty());
    assert_eq!(pages, MAX_PAGES);
    assert!(truncated);
    handle.await.unwrap();
}

#[tokio::test]
async fn report_run_rejects_a_malformed_report_page() {
    let (addr, handle) = serve(vec![r#"{"rows":7}"#.into()]).await;
    let client = super::http_fixture::test_client();
    let error = run_at(
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
    .unwrap_err();
    assert_eq!(error, "Google Analytics returned an invalid report.");
    handle.await.unwrap();
}
