use super::*;
use std::time::{Duration, Instant};
use tokio::{io::AsyncWriteExt, net::TcpListener};

#[tokio::test]
async fn client_timeout_is_kept_when_crawl_deadline_is_longer() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let Ok((mut stream, _)) = listener.accept().await else {
            return;
        };
        tokio::time::sleep(Duration::from_millis(100)).await;
        let _ = stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
            .await;
    });
    let client = reqwest::Client::builder()
        .no_proxy()
        .resolve("timeout.fixture", address)
        .timeout(Duration::from_millis(20))
        .build()
        .unwrap();
    let url = format!("http://timeout.fixture:{}/page", address.port());
    let context = RetryContext::new(RetryBudget::new(0), Instant::now(), Some(60));
    let mut retry_available = false;
    let error = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap_err();
    assert!(matches!(error, RetryError::Request(error) if error.is_timeout()));
    server.await.unwrap();
}

#[test]
fn retry_error_and_context_contract_edges() {
    use std::error::Error;

    let deadline = RetryError::Deadline;
    assert_eq!(deadline.kind(), "timeout");
    assert_eq!(
        deadline.to_string(),
        "HTTP operation exceeded the crawl deadline"
    );
    assert!(deadline.source().is_none());

    let client = reqwest::Client::new();
    let req_err = client
        .get("http://invalid url with spaces")
        .build()
        .unwrap_err();
    let retry_req = RetryError::Request(req_err);
    assert!(!retry_req.kind().is_empty());
    assert!(!retry_req.to_string().is_empty());
    assert!(retry_req.source().is_some());
    let _ = retry_req.into_request();

    let disabled = RetryContext::disabled();
    assert_eq!(disabled.remaining(), None);
    assert_eq!(disabled.budget.remaining(), 0);

    let expired = RetryContext::new(
        RetryBudget::new(1),
        Instant::now().checked_sub(Duration::from_secs(10)).unwrap(),
        Some(1),
    );
    assert_eq!(expired.remaining(), Some(Duration::ZERO));
}
