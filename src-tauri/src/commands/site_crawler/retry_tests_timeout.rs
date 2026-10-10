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
