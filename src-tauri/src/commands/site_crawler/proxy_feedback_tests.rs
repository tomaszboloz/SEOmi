use super::*;
use std::time::Duration;

fn shared(count: usize, max_failures: u32) -> SharedPool {
    let urls: Vec<String> = (0..count)
        .map(|index| format!("http://p{index}.test:1"))
        .collect();
    Arc::new(Mutex::new(
        ProxyPool::new(&urls, max_failures, Duration::from_secs(60)).unwrap(),
    ))
}

fn healthy(pool: &SharedPool) -> usize {
    pool.lock().unwrap().healthy_count(Instant::now())
}

#[test]
fn http_407_bans_after_the_failure_limit_and_other_statuses_reset_the_streak() {
    let pool = shared(2, 2);
    register("https://fb-a.test/", &pool, 0);
    report("https://fb-a.test/", &Ok(407));
    assert_eq!(healthy(&pool), 2);
    register("https://fb-b.test/", &pool, 0);
    report("https://fb-b.test/", &Ok(200));
    register("https://fb-c.test/", &pool, 0);
    report("https://fb-c.test/", &Ok(407));
    assert_eq!(healthy(&pool), 2, "a success in between resets the streak");
    register("https://fb-d.test/", &pool, 0);
    report("https://fb-d.test/", &Ok(407));
    assert_eq!(healthy(&pool), 1);
}

#[test]
fn unregistered_and_unparseable_targets_are_ignored_and_keys_are_normalised() {
    let pool = shared(1, 1);
    report("https://fb-unknown.test/", &Ok(407));
    report("not a url", &Ok(407));
    assert_eq!(healthy(&pool), 1);
    register("https://fb-norm.test/", &pool, 0);
    report("https://fb-norm.test", &Ok(407));
    assert_eq!(
        healthy(&pool),
        0,
        "no trailing slash still matches the registered key"
    );
}

#[test]
fn registry_is_bounded_and_entries_are_consumed_once() {
    let pool = shared(1, 1);
    for index in 0..MAX_PENDING + 5 {
        register(&format!("https://fb-bulk{index}.test/"), &pool, 0);
    }
    assert!(pending().lock().unwrap().len() <= MAX_PENDING);
    register("https://fb-once.test/", &pool, 0);
    report("https://fb-once.test/", &Ok(200));
    report("https://fb-once.test/", &Ok(407));
    assert_eq!(healthy(&pool), 1);
}
