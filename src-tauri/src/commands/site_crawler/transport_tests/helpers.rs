use super::*;

#[tokio::test]
async fn public_client_builder_and_redirect_request_preserve_builder_errors() {
    let client = crawler_client_builder().build().unwrap();
    let config = serde_json::from_value(serde_json::json!({})).unwrap();
    let error = request_with_safe_redirects(
        &client,
        "ftp://example.test/file",
        "example.test",
        false,
        None,
        &[],
        10,
        &config,
    )
    .await
    .err()
    .expect("unsupported transport must fail");
    assert!(error.is_builder());
}

#[test]
fn deadline_and_seen_target_contracts_have_direct_assertions() {
    let now = Instant::now();
    assert!(!crawl_deadline_reached(now, None));
    assert!(!crawl_deadline_reached(now, Some(10)));
    assert!(crawl_deadline_reached(now, Some(0)));
    assert!(crawl_deadline_reached(
        now - std::time::Duration::from_secs(2),
        Some(1)
    ));
    let mut seen = HashSet::new();
    assert!(redirect_target_is_new(&mut seen, "https://example.test/a"));
    assert!(!redirect_target_is_new(&mut seen, "https://example.test/a"));
    assert!(redirect_target_is_new(&mut seen, "https://example.test/b"));
    assert_eq!(seen.len(), 2);
}
