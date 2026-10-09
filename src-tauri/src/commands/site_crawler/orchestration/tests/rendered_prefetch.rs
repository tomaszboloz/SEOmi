use super::super::super::robots::RobotsRule;
use super::super::page_fetch_rendered::render_options;
use super::super::page_prefetch::prefetch_parallelism;
use super::super::rendered_prefetch::take_prefetch_window;
use super::*;
use std::collections::VecDeque;
use std::time::Duration;

#[test]
fn prefetch_window_keeps_crawl_order_and_skips_robots_blocked_candidates() {
    let mut queue = VecDeque::from([
        ("https://example.com/blocked".to_string(), 1),
        ("https://example.com/a".to_string(), 1),
        ("https://example.com/b".to_string(), 2),
        ("https://example.com/c".to_string(), 2),
    ]);
    let mut prefetched_order = VecDeque::new();
    let rules = vec![RobotsRule {
        allow: false,
        path: "/blocked".into(),
    }];

    let candidates = take_prefetch_window(
        &mut queue,
        &mut prefetched_order,
        3,
        &default_crawl_config(None),
        &rules,
    );

    assert_eq!(
        candidates,
        vec!["https://example.com/a", "https://example.com/b"]
    );
    assert_eq!(prefetched_order.len(), 3);
    assert_eq!(prefetched_order[0].0, "https://example.com/blocked");
    assert_eq!(queue.len(), 1);
}

#[test]
fn renderer_windows_are_capped_below_the_http_limit_and_crawl_delay_stays_sequential() {
    let mut config = default_crawl_config(None);
    config.max_concurrent_requests = Some(64);
    assert_eq!(prefetch_parallelism(&config, None), 16);
    assert_eq!(prefetch_parallelism(&config, Some(Duration::ZERO)), 1);
    config.crawl_mode = "browser-rendered".into();
    assert_eq!(prefetch_parallelism(&config, None), 6);
    assert_eq!(prefetch_parallelism(&config, Some(Duration::ZERO)), 1);
    config.max_concurrent_requests = Some(4);
    assert_eq!(prefetch_parallelism(&config, None), 4);
    config.max_concurrent_requests = None;
    assert_eq!(prefetch_parallelism(&config, None), 1);
}

#[test]
fn renderer_options_carry_the_allowlist_and_bounded_wait_settings() {
    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    config.allowed_hosts = vec!["Docs.Example.Test".into()];
    config.render_wait_for_selector = Some("  main  ".into());
    config.render_wait_delay_ms = Some(u64::MAX);
    config.render_lazy_scroll_cycles = Some(usize::MAX);
    let setup = setup(config);
    let options = render_options(&setup);
    assert_eq!(options.allowed_hosts, vec!["docs.example.test"]);
    assert_eq!(options.wait_for_selector.as_deref(), Some("main"));
    assert_eq!(
        (options.wait_delay_ms, options.lazy_scroll_cycles),
        (10_000, 40)
    );
    assert_eq!(options.user_agent.as_deref(), Some(setup.ua.as_str()));
    assert!(options.cookie.is_none());
}

#[test]
fn prefetch_window_breaks_when_queue_exhausted_and_ignores_robots_when_disabled() {
    let mut queue = VecDeque::from([("https://example.com/one".to_string(), 1)]);
    let mut prefetched_order = VecDeque::new();
    let mut config = default_crawl_config(None);
    config.respect_robots = false;
    let rules = vec![RobotsRule {
        allow: false,
        path: "/one".into(),
    }];
    let candidates = take_prefetch_window(&mut queue, &mut prefetched_order, 5, &config, &rules);
    assert_eq!(candidates, vec!["https://example.com/one"]);
    assert_eq!(prefetched_order.len(), 1);
    assert!(queue.is_empty());
}
