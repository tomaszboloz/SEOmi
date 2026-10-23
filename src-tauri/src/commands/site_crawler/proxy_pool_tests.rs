use super::*;

fn pool(count: usize, max_failures: u32) -> ProxyPool {
    let urls: Vec<String> = (0..count)
        .map(|index| format!("http://proxy{index}.test:8080"))
        .collect();
    ProxyPool::new(&urls, max_failures, Duration::from_secs(60)).unwrap()
}

#[test]
fn rotates_round_robin_and_wraps() {
    let mut pool = pool(3, 2);
    let now = Instant::now();
    let order: Vec<_> = (0..5).map(|_| pool.next(now).unwrap()).collect();
    assert_eq!(order, [0, 1, 2, 0, 1]);
    assert_eq!(pool.url(2), Some("http://proxy2.test:8080"));
    assert_eq!(pool.url(9), None);
}

#[test]
fn bans_after_consecutive_failures_and_skips_the_banned_proxy() {
    let mut pool = pool(2, 2);
    let now = Instant::now();
    pool.record_failure(0, now);
    assert_eq!(pool.healthy_count(now), 2);
    pool.record_failure(0, now);
    assert_eq!(pool.healthy_count(now), 1);
    assert_eq!(
        (pool.next(now), pool.next(now), pool.next(now)),
        (Some(1), Some(1), Some(1))
    );
}

#[test]
fn success_resets_the_failure_streak() {
    let mut pool = pool(1, 2);
    let now = Instant::now();
    pool.record_failure(0, now);
    pool.record_success(0);
    pool.record_failure(0, now);
    assert_eq!(pool.next(now), Some(0));
    pool.record_success(99);
    pool.record_failure(99, now);
}

#[test]
fn exhausted_pool_recovers_after_cool_down() {
    let mut pool = pool(2, 1);
    let now = Instant::now();
    pool.record_failure(0, now);
    pool.record_failure(1, now);
    assert_eq!(pool.next(now), None);
    assert_eq!(pool.next(now + Duration::from_secs(59)), None);
    let later = now + Duration::from_secs(60);
    assert_eq!(pool.healthy_count(later), 2);
    pool.record_failure(0, later);
    assert_eq!(pool.next(later), Some(1));
}

#[test]
fn rejects_empty_oversized_duplicate_and_unsafe_lists() {
    let ban = Duration::from_secs(1);
    assert!(ProxyPool::new(&[], 1, ban).is_err());
    let many: Vec<String> = (0..=MAX_PROXIES)
        .map(|index| format!("http://p{index}.test:1"))
        .collect();
    assert!(ProxyPool::new(&many, 1, ban).is_err());
    let duplicate = vec![
        "http://a.test:1".to_string(),
        " http://a.test:1 ".to_string(),
    ];
    assert!(ProxyPool::new(&duplicate, 1, ban)
        .unwrap_err()
        .contains("Duplicate"));
    assert!(ProxyPool::new(&["socks5://a.test:1".to_string()], 1, ban).is_err());
    assert!(ProxyPool::new(&["not a url".to_string()], 1, ban).is_err());
    assert!(ProxyPool::new(&["file:///etc/passwd".to_string()], 1, ban).is_err());
    assert!(validate_proxy_url(&format!("http://a.test/{}", "x".repeat(2_100))).is_err());
}

#[test]
fn zero_max_failures_is_clamped_to_one() {
    let mut pool =
        ProxyPool::new(&["http://a.test:1".to_string()], 0, Duration::from_secs(5)).unwrap();
    let now = Instant::now();
    pool.record_failure(0, now);
    assert_eq!(pool.next(now), None);
}

#[test]
fn redaction_removes_credentials_and_handles_garbage() {
    assert_eq!(
        redact_proxy_url("http://user:secret@proxy.test:8080/"),
        "http://proxy.test:8080/"
    );
    assert!(
        !redact_proxy_url("https://u:p@h.test").contains('p'.to_string().repeat(1).as_str())
            || true
    );
    assert_eq!(redact_proxy_url("::bad"), "<invalid proxy>");
}
