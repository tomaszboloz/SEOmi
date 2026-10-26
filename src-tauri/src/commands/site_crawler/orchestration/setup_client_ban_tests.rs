use super::*;
use crate::commands::site_crawler::retry::{send_get_with_retry, RetryContext};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

async fn live_proxy() -> (String, Arc<AtomicUsize>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let hits = Arc::new(AtomicUsize::new(0));
    let counter = hits.clone();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let counter = counter.clone();
            tokio::spawn(async move {
                let mut buffer = [0u8; 1024];
                let _ = socket.read(&mut buffer).await;
                counter.fetch_add(1, Ordering::SeqCst);
                let _ = socket
                    .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 0\r\nconnection: close\r\n\r\n")
                    .await;
            });
        }
    });
    (address, hits)
}

async fn dead_proxy() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);
    address
}

async fn fetch(client: &reqwest::Client, url: &str) -> bool {
    let mut retry = false;
    send_get_with_retry(client, url, &RetryContext::disabled(), &mut retry)
        .await
        .is_ok()
}

#[tokio::test]
async fn a_dead_proxy_is_banned_and_later_requests_use_the_live_one() {
    let (live, hits) = live_proxy().await;
    let list = format!("{},{live}", dead_proxy().await);
    let proxy = rotating_proxy_with(&list, 1, std::time::Duration::from_secs(60)).unwrap();
    let client = reqwest::Client::builder().proxy(proxy).build().unwrap();
    assert!(
        !fetch(&client, "http://ban-one.test/").await,
        "first request hits the dead proxy"
    );
    for index in 0..3 {
        assert!(fetch(&client, &format!("http://ban-next{index}.test/")).await);
    }
    assert_eq!(hits.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn a_fully_banned_pool_never_falls_back_to_a_direct_connection() {
    // The target is reachable directly, so a leaked direct connection would succeed.
    let (target, direct_hits) = live_proxy().await;
    let list = format!("{},{}", dead_proxy().await, dead_proxy().await);
    let proxy = rotating_proxy_with(&list, 1, std::time::Duration::from_secs(60)).unwrap();
    let client = reqwest::Client::builder().proxy(proxy).build().unwrap();
    for index in 0..4 {
        assert!(!fetch(&client, &format!("{target}/never{index}")).await);
    }
    assert_eq!(direct_hits.load(Ordering::SeqCst), 0);
}
