use super::*;
use std::time::{Duration, Instant};
use tokio::{io::AsyncWriteExt, net::TcpListener};

#[tokio::test]
async fn response_body_reads_honor_the_crawl_deadline() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_secs(5)).await;
    });
    let client = reqwest::Client::builder()
        .no_proxy()
        .resolve("body.fixture", address)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    let url = format!("http://body.fixture:{}/page", address.port());
    let context = RetryContext::new(RetryBudget::new(0), Instant::now(), Some(1));
    let mut retry_available = false;
    let mut response = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap()
        .response;
    let error = read_response_chunk(&mut response, &context)
        .await
        .unwrap_err();
    assert!(matches!(error, RetryError::Deadline));
    server.abort();
}

#[tokio::test]
async fn read_response_chunk_with_zero_remaining_deadline_and_unmetered() {
    let (client, url, server) = super::fixture(vec![
        "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nhello",
    ])
    .await;
    let context = RetryContext::new(RetryBudget::new(0), Instant::now(), None);
    let mut retry_available = false;
    let mut response = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap()
        .response;

    let expired = RetryContext::new(
        RetryBudget::new(0),
        Instant::now() - Duration::from_secs(5),
        Some(1),
    );
    let err = read_response_chunk(&mut response, &expired)
        .await
        .unwrap_err();
    assert!(matches!(err, RetryError::Deadline));

    let unmetered = RetryContext::new(RetryBudget::new(0), Instant::now(), None);
    let chunk = read_response_chunk(&mut response, &unmetered)
        .await
        .unwrap();
    assert_eq!(chunk, Some(b"hello".to_vec()));
    server.await.unwrap();
}
