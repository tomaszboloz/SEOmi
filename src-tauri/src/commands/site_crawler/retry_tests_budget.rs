use super::*;
use std::time::Instant;

#[tokio::test]
async fn retry_budget_is_shared_across_requests() {
    let (client, url, server) = super::fixture(vec![
        "HTTP/1.1 503 Service Unavailable\r\nRetry-After: 0\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    ])
    .await;
    let budget = RetryBudget::new(1);
    let context = RetryContext::new(budget.clone(), Instant::now(), None);
    let mut retry_available = true;
    let first = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap();
    assert_eq!(first.response.status(), 200);
    assert_eq!(first.retries, 1);
    drop(first);

    let mut retry_available = true;
    let second = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap();
    assert_eq!(second.response.status(), 503);
    assert_eq!(second.retries, 0);
    assert_eq!(budget.remaining(), 0);
    assert_eq!(server.await.unwrap().len(), 3);
}

#[test]
fn retry_budget_is_atomic_under_concurrency() {
    let budget = RetryBudget::new(7);
    let handles = (0..64)
        .map(|_| {
            let budget = budget.clone();
            std::thread::spawn(move || budget.take())
        })
        .collect::<Vec<_>>();
    let successful = handles
        .into_iter()
        .filter_map(|handle| handle.join().ok())
        .filter(|taken| *taken)
        .count();
    assert_eq!(successful, 7);
    assert_eq!(budget.remaining(), 0);
}

#[tokio::test]
async fn a_request_chain_retries_only_once_when_status_stays_transient() {
    let (client, url, server) = super::fixture(vec![
        "HTTP/1.1 503 Service Unavailable\r\nRetry-After: 0\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    ])
    .await;
    let context = RetryContext::new(RetryBudget::new(2), Instant::now(), None);
    let mut retry_available = true;
    let result = send_get_with_retry(&client, &url, &context, &mut retry_available)
        .await
        .unwrap();
    assert_eq!(result.response.status(), 503);
    assert_eq!(result.retries, 1);
    assert!(!retry_available);
    assert_eq!(server.await.unwrap().len(), 2);
}
