use super::*;
use std::time::{Duration, Instant};

#[tokio::test]
async fn bounded_text_reads_surface_deadline_errors_as_text() {
    let (client, url, server) = super::fixture(vec![
        "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nhello",
    ])
    .await;
    let open = RetryContext::new(RetryBudget::new(0), Instant::now(), None);
    let mut retry_available = false;
    let response = send_get_with_retry(&client, &url, &open, &mut retry_available)
        .await
        .unwrap()
        .response;
    let expired = RetryContext::new(
        RetryBudget::new(0),
        Instant::now() - Duration::from_secs(5),
        Some(1),
    );
    let error = read_bounded_text_with_retry(response, 100, &expired)
        .await
        .unwrap_err();
    assert!(!error.is_empty());
    server.await.unwrap();
}
