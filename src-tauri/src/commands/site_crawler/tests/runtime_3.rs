use super::*;

#[test]
fn redirect_hop_timing_is_optional_for_legacy_snapshots() {
    let hop = CrawledRedirectHop {
        from_url: "https://example.com/old".into(),
        http_status: 301,
        to_url: "https://example.com/new".into(),
        response_time_ms: Some(42),
    };
    let encoded = serde_json::to_value(&hop).unwrap();
    assert_eq!(encoded["response_time_ms"], serde_json::json!(42));

    let legacy: CrawledRedirectHop = serde_json::from_value(serde_json::json!({
        "from_url": "https://example.com/old",
        "http_status": 301,
        "to_url": "https://example.com/new"
    }))
    .unwrap();
    assert_eq!(legacy.response_time_ms, None);
}

#[test]
fn filter_validation_uses_the_crawler_regex_engine_and_explains_preview_decisions() {
    let result = validate_crawl_filters(
        vec!["/docs/".into()],
        vec!["private".into()],
        vec![
            "https://example.com/docs/guide".into(),
            "https://example.com/docs/private".into(),
            "https://example.com/blog/post".into(),
        ],
    );

    assert!(result.valid);
    assert_eq!(
        result
            .previews
            .iter()
            .map(|item| item.included)
            .collect::<Vec<_>>(),
        vec![true, false, false]
    );
    assert_eq!(result.previews[1].reason, "Matches an exclude pattern");
    assert_eq!(
        result.previews[2].reason,
        "Does not match any include pattern"
    );
}

#[test]
fn filter_validation_reports_invalid_regex_without_starting_a_crawl() {
    let result = validate_crawl_filters(vec!["(".into()], Vec::new(), Vec::new());

    assert!(!result.valid);
    assert_eq!(result.errors.len(), 1);
    assert_eq!(result.errors[0].filter, "include");
    assert_eq!(result.errors[0].pattern, "(");
    assert!(result.previews.is_empty());
}

#[test]
fn link_targets_are_normalized_before_matching_crawled_pages() {
    let mut target = url::Url::parse("https://example.com/article?source=ad#section").unwrap();
    target.set_fragment(None);
    target.set_query(None);
    assert_eq!(target.as_str(), "https://example.com/article");
}

#[test]
fn crawl_deadline_is_enforced_from_the_start_of_the_run() {
    let expired = Instant::now() - std::time::Duration::from_secs(2);
    assert!(crawl_deadline_reached(expired, Some(1)));
    assert!(!crawl_deadline_reached(Instant::now(), Some(60)));
    assert!(!crawl_deadline_reached(expired, None));
}

#[test]
fn transport_error_classifier_preserves_root_cause_fixtures() {
    let fixtures = [
        (
            false,
            true,
            "error sending request: dns error: failed to lookup address information",
            "dns",
        ),
        (
            false,
            true,
            "error trying to connect: invalid peer certificate: unknown CA",
            "tls",
        ),
        (
            false,
            true,
            "error trying to connect: tcp connection refused",
            "connect",
        ),
        (
            true,
            true,
            "error sending request: operation timed out",
            "timeout",
        ),
        (
            false,
            false,
            "error while reading response body: protocol failure",
            "network",
        ),
    ];

    for (is_timeout, is_connect, detail, expected) in fixtures {
        assert_eq!(
            classify_request_error(is_timeout, is_connect, detail),
            expected,
            "fixture should classify as {expected}: {detail}"
        );
    }
}

#[test]
fn extracts_locations_from_urlset_and_sitemap_index() {
    let locations = parse_sitemap_locations("<urlset><url><loc>https://example.com/a</loc></url><sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap></urlset>");
    assert_eq!(
        locations,
        vec!["https://example.com/a", "https://example.com/sitemap-2.xml"]
    );
}
