use super::*;
use std::time::{Duration, Instant};

#[test]
fn duplicate_matching_agent_lines_keep_group_active_and_bad_values_are_ignored() {
    let content = "User-agent: seomi\nUser-agent: seomi\nCrawl-delay: nope\nCrawl-delay: 2\n";
    assert_eq!(
        parse_robots_crawl_delay(content, "seomi"),
        Some(Duration::from_secs(2))
    );
    assert_eq!(
        parse_robots_crawl_delay("User-agent: seomi\nCrawl-delay: nope\n", "seomi"),
        None
    );
}

#[tokio::test]
async fn waiting_continues_after_a_paused_run_is_resumed() {
    let control = std::sync::Arc::new(CrawlControl::new());
    control.start("resume");
    control.pause("resume");
    let waiting = control.clone();
    let waiter = tokio::spawn(async move {
        wait_for_crawl_delay(&waiting, "resume", Instant::now(), Duration::from_millis(1)).await
    });
    tokio::time::sleep(Duration::from_millis(20)).await;
    control.resume("resume");
    assert!(waiter.await.unwrap());
}

#[tokio::test(start_paused = true)]
async fn pause_time_does_not_consume_crawl_delay() {
    let control = std::sync::Arc::new(CrawlControl::new());
    control.start("p");
    control.pause("p");
    let started = tokio::time::Instant::now();
    let waiting = control.clone();
    let waiter = tokio::spawn(async move {
        wait_for_crawl_delay(&waiting, "p", started.into_std(), Duration::from_secs(1)).await
    });
    tokio::time::sleep(Duration::from_secs(5)).await;
    control.resume("p");
    assert!(waiter.await.unwrap());
    assert!(started.elapsed() >= Duration::from_secs(5));
}
