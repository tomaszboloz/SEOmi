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
