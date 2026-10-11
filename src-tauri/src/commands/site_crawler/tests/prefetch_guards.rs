use super::*;
use std::collections::{HashMap, VecDeque};

#[tokio::test]
async fn prefetch_http_pages_handles_insufficient_slots_and_empty_queue() {
    let mut queue = VecDeque::new();
    let mut prefetched_order = VecDeque::new();
    let mut prefetched_responses = HashMap::new();
    let client = reqwest::Client::new();
    let mut config = crawl_config_for_test();
    config.respect_robots = false;
    // 1. empty queue
    prefetch_http_pages(
        &mut queue,
        &mut prefetched_order,
        &mut prefetched_responses,
        4,
        10,
        0,
        &client,
        "127.0.0.1",
        false,
        None,
        &[],
        10,
        &config,
        &[],
    )
    .await;
    assert!(prefetched_order.is_empty());
    // 2. slots < 2 (slots = 1)
    queue.push_back(("https://example.com/".into(), 0));
    prefetch_http_pages(
        &mut queue,
        &mut prefetched_order,
        &mut prefetched_responses,
        1,
        10,
        0,
        &client,
        "127.0.0.1",
        false,
        None,
        &[],
        10,
        &config,
        &[],
    )
    .await;
    assert_eq!(queue.len(), 1);
    assert!(prefetched_order.is_empty());
}
#[tokio::test]
async fn prefetch_http_pages_respect_robots_false_skips_robots_filter() {
    let mut queue = VecDeque::new();
    queue.push_back(("http://127.0.0.1:9/one".into(), 0));
    queue.push_back(("http://127.0.0.1:9/two".into(), 0));
    let mut prefetched_order = VecDeque::new();
    let mut prefetched_responses = HashMap::new();
    let client = reqwest::Client::new();
    let mut config = crawl_config_for_test();
    config.respect_robots = false;
    prefetch_http_pages(
        &mut queue,
        &mut prefetched_order,
        &mut prefetched_responses,
        2,
        10,
        0,
        &client,
        "127.0.0.1",
        false,
        None,
        &[],
        10,
        &config,
        &[],
    )
    .await;
    assert_eq!(prefetched_order.len(), 2);
    assert_eq!(prefetched_responses.len(), 2);
}
#[tokio::test]
async fn prefetch_http_pages_reads_and_converts_http_body() {
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = tokio::spawn(async move {
        for _ in 0..2 {
            if let Ok((mut stream, _)) = listener.accept().await {
                let mut buffer = [0_u8; 4096];
                let mut request = Vec::new();
                while !request.windows(4).any(|window| window == b"\r\n\r\n")
                    && request.len() < 16_384
                {
                    let read = stream.read(&mut buffer).await.expect("request read");
                    assert!(read > 0, "fixture client closed before request headers");
                    request.extend_from_slice(&buffer[..read]);
                }
                assert!(
                    request.windows(4).any(|window| window == b"\r\n\r\n"),
                    "headers incomplete"
                );
                stream
                    .write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\ntest",
                    )
                    .await
                    .expect("fixture response write");
                stream.shutdown().await.expect("fixture response shutdown");
            }
        }
    });
    let mut queue = VecDeque::new();
    queue.push_back((format!("http://127.0.0.1:{port}/a"), 0));
    queue.push_back((format!("http://127.0.0.1:{port}/b"), 0));
    let mut prefetched_order = VecDeque::new();
    let mut prefetched_responses = HashMap::new();
    let client = reqwest::Client::new();
    let mut config = crawl_config_for_test();
    config.respect_robots = false;
    prefetch_http_pages(
        &mut queue,
        &mut prefetched_order,
        &mut prefetched_responses,
        2,
        10,
        0,
        &client,
        "127.0.0.1",
        false,
        None,
        &[],
        10,
        &config,
        &[],
    )
    .await;
    assert_eq!(prefetched_order.len(), 2);
    assert_eq!(prefetched_responses.len(), 2);
    for entry in prefetched_responses.values() {
        let fetched = entry.as_ref().unwrap();
        assert!(matches!(fetched.response, FetchedPageBody::Prefetched(_)));
    }
    server.await.unwrap();
}
