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

#[test]
fn transport_and_request_errors_attribute_failures_and_poisoned_locks_are_handled() {
    let pool = shared(1, 2);
    register("https://fb-err.test/", &pool, 0);

    let runtime = tokio::runtime::Runtime::new().unwrap();
    let connect_err = runtime.block_on(async {
        reqwest::Client::builder()
            .no_proxy()
            .build()
            .unwrap()
            .get("http://127.0.0.1:1/")
            .send()
            .await
            .unwrap_err()
    });
    assert!(connect_err.is_connect());
    report("https://fb-err.test/", &Err(&connect_err));
    assert_eq!(healthy(&pool), 1);

    let parse_err = reqwest::Client::new()
        .get("http://invalid url with spaces/")
        .build()
        .unwrap_err();
    assert!(!parse_err.is_connect() && !parse_err.is_timeout());
    register("https://fb-reset.test/", &pool, 0);
    report("https://fb-reset.test/", &Err(&parse_err));
    assert_eq!(healthy(&pool), 1);

    register("https://fb-err1.test/", &pool, 0);
    report("https://fb-err1.test/", &Err(&connect_err));
    register("https://fb-err2.test/", &pool, 0);
    report("https://fb-err2.test/", &Err(&connect_err));
    assert_eq!(healthy(&pool), 0);

    register("https://fb-poison.test/", &pool, 0);
    let pool_clone = Arc::clone(&pool);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = pool_clone.lock().unwrap();
        panic!("deliberate poison");
    }));
    assert!(pool.is_poisoned());
    report("https://fb-poison.test/", &Ok(200));
}
