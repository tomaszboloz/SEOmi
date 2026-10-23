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
    assert_eq!(
        parse_robots_crawl_delay("User-agent: *\nCrawl-delay: -5\n", "seomi"),
        None
    );
    assert_eq!(
        parse_robots_crawl_delay("User-agent: *\nCrawl-delay: 0.0\n", "seomi"),
        None
    );
    assert_eq!(
        parse_robots_crawl_delay("User-agent: *\nCrawl-delay: inf\n", "seomi"),
        None
    );
}

#[test]
fn parser_prioritizes_specific_agent_over_wildcard_and_handles_directive_toggles() {
    let specific_first = "User-agent: seomi\nCrawl-delay: 2.5\nUser-agent: *\nCrawl-delay: 10\n";
    assert_eq!(
        parse_robots_crawl_delay(specific_first, "seomi"),
        Some(Duration::from_millis(2500))
    );
    assert_eq!(
        parse_robots_crawl_delay(specific_first, "otherbot"),
        Some(Duration::from_millis(10000))
    );

    let wildcard_first = "User-agent: *\nCrawl-delay: 10\nUser-agent: seomi\nCrawl-delay: 3\n";
    assert_eq!(
        parse_robots_crawl_delay(wildcard_first, "seomi"),
        Some(Duration::from_millis(3000))
    );

    let multi_agents = "User-agent: bot1\nUser-agent: seomi\nCrawl-delay: 4\n";
    assert_eq!(
        parse_robots_crawl_delay(multi_agents, "seomi"),
        Some(Duration::from_millis(4000))
    );

    let switch_group_disallow =
        "User-agent: seomi\nDisallow: /admin\nUser-agent: other\nCrawl-delay: 15\n";
    assert_eq!(
        parse_robots_crawl_delay(switch_group_disallow, "seomi"),
        None
    );

    let switch_group_allow =
        "User-agent: other\nAllow: /public\nUser-agent: seomi\nCrawl-delay: 7\n";
    assert_eq!(
        parse_robots_crawl_delay(switch_group_allow, "seomi"),
        Some(Duration::from_millis(7000))
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
            Duration::from_secs(3600),
        )
        .await
    });
    tokio::task::yield_now().await;
    control.cancelled_runs.lock().unwrap().insert("run".into());
    assert!(!waiter.await.unwrap());

    let cancelled_control = CrawlControl::new();
    cancelled_control.start("c1");
    cancelled_control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert("c1".into());
    assert!(
        !wait_for_crawl_delay(
            &cancelled_control,
            "c1",
            Instant::now(),
            Duration::from_secs(5)
        )
        .await
    );

    cancelled_control.start("c2");
    cancelled_control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert("c2".into());
    let past = Instant::now() - Duration::from_secs(1);
    assert!(!wait_for_crawl_delay(&cancelled_control, "c2", past, Duration::from_millis(10)).await);

    let normal_control = CrawlControl::new();
    normal_control.start("c3");
    assert!(
        wait_for_crawl_delay(
            &normal_control,
            "c3",
            Instant::now(),
            Duration::from_millis(1)
        )
        .await
    );
}
