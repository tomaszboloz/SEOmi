use super::*;
use std::time::{Duration, Instant};

#[test]
fn parser_ignores_comments_invalid_values_and_nonmatching_groups() {
    let content = "\n# comment\nnot a directive\nUser-agent: other\nCrawl-delay: nope\nUser-agent: *\nCrawl-delay: 0\nCrawl-delay: NaN\n";
    assert_eq!(parse_robots_crawl_delay(content, "seomi"), None);
    assert_eq!(
        parse_robots_crawl_delay("User-agent: SEOMI\nCrawl-delay: 0.001\n", "seomi"),
        Some(Duration::from_millis(1))
    );
}

#[tokio::test]
async fn waiting_honours_pause_and_cancellation() {
    let control = std::sync::Arc::new(CrawlControl::new());
    control.start("run");
    control.pause("run");
    let waiting_control = control.clone();
    let waiter = tokio::spawn(async move {
        wait_for_crawl_delay(
            &waiting_control,
            "run",
            Instant::now(),
            Duration::from_millis(1),
        )
        .await
    });
    tokio::time::sleep(Duration::from_millis(10)).await;
    control.cancelled_runs.lock().unwrap().insert("run".into());
    assert!(!waiter.await.unwrap());
}
