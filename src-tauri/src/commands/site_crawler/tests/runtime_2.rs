use super::*;

#[test]
fn rendered_profile_accepts_cookie_only_credentials() {
    let profile = CrawlAuthProfile {
        headers: Vec::new(),
        cookie: Some("session=opaque".into()),
        proxy_url: None,
    };

    assert!(!rendered_profile_has_unsupported_transport(&profile));
}

#[test]
fn rendered_profile_rejects_custom_headers_or_proxy() {
    let with_header = CrawlAuthProfile {
        headers: vec![crate::commands::settings::CrawlProfileHeader {
            name: "Authorization".into(),
            value: "Bearer opaque".into(),
        }],
        cookie: Some("session=opaque".into()),
        proxy_url: None,
    };
    let with_proxy = CrawlAuthProfile {
        headers: Vec::new(),
        cookie: None,
        proxy_url: Some("https://proxy.example".into()),
    };

    assert!(rendered_profile_has_unsupported_transport(&with_header));
    assert!(rendered_profile_has_unsupported_transport(&with_proxy));
}

#[test]
fn intrinsic_favicon_dimensions_decode_largest_ico_entry() {
    let mut bytes = vec![0, 0, 1, 0, 2, 0];
    // 16x16 entry followed by a 32x32 entry. The remaining directory
    // fields are not needed for intrinsic dimensions.
    bytes.extend_from_slice(&[16, 16, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    bytes.extend_from_slice(&[32, 32, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/x-icon"), &bytes),
        Some((32, 32))
    );
}

#[test]
fn favicon_metadata_keeps_bounded_data_image_declarations() {
    let document = Html::parse_document(
        r#"<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%3E%3C/svg%3E">"#,
    );
    let base = url::Url::parse("https://example.com/page").unwrap();

    let metadata = crawl_favicon_metadata(&document, &base);

    assert_eq!(metadata.len(), 1);
    assert!(metadata[0].href.starts_with("data:image/svg+xml,"));
    assert_eq!(metadata[0].declared_type.as_deref(), Some("image/svg+xml"));
    assert_eq!(metadata[0].inferred_format.as_deref(), Some("svg+xml"));
}

#[test]
fn test_crawl_site_ssrf_protection() {
    let result = validate_and_normalize_url("http://127.0.0.1:8080");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("SSRF"));
}

#[test]
fn test_crawl_site_invalid_scheme() {
    let result = validate_and_normalize_url("ftp://example.com");
    assert!(result.is_err());
}

#[test]
fn crawl_control_pauses_and_resumes_the_same_run() {
    let control = CrawlControl::new();
    control.start("run-1");
    control.pause("run-1");
    assert!(control.is_paused("run-1"));
    assert!(!control.is_cancelled("run-1"));

    control.resume("run-1");
    assert!(!control.is_paused("run-1"));
}

#[tokio::test]
async fn http_prefetch_keeps_robots_blocked_pages_in_order_without_fetching_them() {
    let mut queue = VecDeque::from([
        ("http://127.0.0.1:9/blocked".to_string(), 0),
        ("http://127.0.0.1:9/allowed".to_string(), 0),
    ]);
    let mut prefetched_order = VecDeque::new();
    let mut prefetched_responses = HashMap::new();
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(std::time::Duration::from_millis(100))
        .build()
        .expect("test client should build");
    let config = crawl_config_for_test();

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
        &[RobotsRule {
            allow: false,
            path: "/blocked".into(),
        }],
    )
    .await;

    assert_eq!(
        prefetched_order.into_iter().collect::<Vec<_>>(),
        vec![
            ("http://127.0.0.1:9/blocked".into(), 0),
            ("http://127.0.0.1:9/allowed".into(), 0),
        ]
    );
    assert!(
        !prefetched_responses.contains_key("http://127.0.0.1:9/blocked"),
        "robots-disallowed URLs must be handled by the main loop"
    );
    assert!(
        prefetched_responses.contains_key("http://127.0.0.1:9/allowed"),
        "allowed URLs should receive a bounded prefetch result"
    );
    assert!(queue.is_empty());
}

#[test]
fn redirect_loop_guard_rejects_a_repeated_target() {
    let mut seen = HashSet::from(["https://example.com/a".to_string()]);
    assert!(redirect_target_is_new(&mut seen, "https://example.com/b"));
    assert!(!redirect_target_is_new(&mut seen, "https://example.com/a"));
}
