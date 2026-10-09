use super::*;
use chrono::{TimeZone, Utc};
use std::time::{Duration, Instant};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

async fn fixture(
    responses: Vec<&'static str>,
) -> (
    reqwest::Client,
    String,
    tokio::task::JoinHandle<Vec<String>>,
) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let expected = responses.len();
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for response in responses {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 512];
            while let Ok(count) = stream.read(&mut buffer).await {
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..count]);
                if request.windows(4).any(|part| part == b"\r\n\r\n") {
                    break;
                }
            }
            if request.is_empty() {
                break;
            }
            requests.push(String::from_utf8(request).unwrap());
            if stream.write_all(response.as_bytes()).await.is_err() {
                break;
            }
            stream.shutdown().await.unwrap();
        }
        assert_eq!(requests.len(), expected);
        requests
    });
    let client = reqwest::Client::builder()
        .no_proxy()
        .resolve("retry.fixture", address)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    (
        client,
        format!("http://retry.fixture:{}/page", address.port()),
        task,
    )
}

#[test]
fn retry_after_parses_seconds_dates_and_invalid_values_with_a_cap() {
    let now = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
    assert_eq!(retry_after_delay(" 2 ", now), Some(Duration::from_secs(2)));
    assert_eq!(
        retry_after_delay("Thu, 01 Jan 2026 00:01:00 GMT", now),
        Some(MAX_RETRY_AFTER)
    );
    assert_eq!(retry_after_delay("not-a-date", now), None);
    assert!(retryable_status(429));
    assert!(retryable_status(502));
    assert!(retryable_status(503));
    assert!(retryable_status(504));
    assert!(!retryable_status(500));
}

#[tokio::test]
async fn transient_status_is_retried_once_and_keeps_local_evidence() {
    let (client, url, server) = fixture(vec![
        "HTTP/1.1 503 Service Unavailable\r\nRetry-After: 0\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    ])
    .await;
    let context = RetryContext::new(RetryBudget::new(1), Instant::now(), None);
    let mut retry_available = true;
    let result = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap();
    assert_eq!(result.response.status(), 200);
    assert_eq!(result.retries, 1);
    assert!(!retry_available);
    let requests = server.await.unwrap();
    assert_eq!(requests.len(), 2);
}

#[tokio::test]
async fn exhausted_budget_returns_transient_status_without_a_second_request() {
    let (client, url, server) = fixture(vec![
        "HTTP/1.1 429 Too Many Requests\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    ])
    .await;
    let context = RetryContext::new(RetryBudget::new(0), Instant::now(), None);
    let mut retry_available = true;
    let result = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap();
    assert_eq!(result.response.status(), 429);
    assert_eq!(result.retries, 0);
    assert!(retry_available);
    assert_eq!(context.budget.remaining(), 0);
    assert_eq!(server.await.unwrap().len(), 1);
}

#[tokio::test]
async fn retry_after_delay_cannot_outlive_the_crawl_deadline() {
    let (client, url, server) = fixture(vec![
        "HTTP/1.1 503 Service Unavailable\r\nRetry-After: 30\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    ])
    .await;
    let context = RetryContext::new(RetryBudget::new(1), Instant::now(), Some(1));
    let mut retry_available = true;
    let error = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap_err();
    assert!(matches!(error, RetryError::Deadline), "got {error:?}");
    assert_eq!(server.await.unwrap().len(), 1);
}

#[path = "retry_tests_body.rs"]
mod body;
#[path = "retry_tests_budget.rs"]
mod budget;
#[path = "retry_tests_timeout.rs"]
mod timeout;
