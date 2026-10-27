use super::super::admin::discover_at;
use super::http_fixture::test_client;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[tokio::test]
async fn more_candidates_than_the_cap_are_reported_as_partial() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let summaries = (1..=40)
        .map(|id| format!(r#"{{"property":"properties/{id}"}}"#))
        .collect::<Vec<_>>()
        .join(",");
    let accounts = format!(r#"{{"accountSummaries":[{{"propertySummaries":[{summaries}]}}]}}"#);
    let server = tokio::spawn(async move {
        loop {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buffer = vec![0u8; 4096];
            let size = stream.read(&mut buffer).await.unwrap();
            let request = String::from_utf8_lossy(&buffer[..size]).into_owned();
            let body = if request.contains("accountSummaries") {
                accounts.clone()
            } else {
                "{}".into()
            };
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(head.as_bytes()).await;
            let _ = stream.shutdown().await;
        }
    });
    let endpoint = format!("{base}/v1beta/accountSummaries");
    let discovery = discover_at(
        &test_client(),
        "token",
        "https://example.com/",
        &endpoint,
        &base,
    )
    .await
    .unwrap();
    server.abort();
    assert_eq!(discovery.candidates_checked, 32);
    assert!(discovery.may_be_truncated);
    assert!(discovery.property.is_none());
}
