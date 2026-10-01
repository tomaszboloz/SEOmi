use super::*;

fn post_processing_page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 0, "schema_types": [], "schema_syntax_errors": 0,
        "hreflangs": [], "h1_count": 0, "heading_counts": [0, 0, 0, 0, 0, 0],
        "internal_link_count": 0, "external_link_count": 0,
        "links": [], "images": [], "issues_count": 0, "issues": []
    }))
    .unwrap()
}

#[test]
fn scoring_counts_severities_and_caps_penalties() {
    let empty = score_pages(&[]);
    assert_eq!(empty.health_score, 100);
    let mut page = post_processing_page("https://example.com");
    page.issues = vec![
        CrawledPageIssue {
            severity: "Critical".into(),
            message: "fixture".into(),
        },
        CrawledPageIssue {
            severity: "Warning".into(),
            message: "fixture".into(),
        },
        CrawledPageIssue {
            severity: "Info".into(),
            message: "fixture".into(),
        },
    ];
    let score = score_pages(&[page.clone()]);
    assert_eq!(
        (
            score.critical_count,
            score.warning_count,
            score.notice_count,
            score.health_score
        ),
        (1, 1, 1, 80)
    );
    assert_eq!(score_pages(&vec![page; 10]).health_score, 20);
}

#[test]
fn post_processing_duplicates_preserves_distinct_and_missing_titles() {
    let mut pages = vec![
        post_processing_page("https://example.com/a"),
        post_processing_page("https://example.com/b"),
    ];
    annotate_duplicates(&mut pages);
    assert!(pages.iter().all(|page| page.issues.is_empty()));
    for page in &mut pages {
        page.title = Some("Same title".into());
    }
    annotate_duplicates(&mut pages);
    assert!(pages.iter().all(|page| page
        .issues
        .iter()
        .any(|issue| issue.message.contains("Duplicate title"))));
    assert!(pages
        .iter()
        .all(|page| page.issues_count == page.issues.len()));
}

#[test]
fn post_processing_links_uses_observed_target_status_only() {
    let mut source = post_processing_page("https://example.com/a");
    source.links.push(
        serde_json::from_value(serde_json::json!({
            "target_url": "https://example.com/b", "anchor_text": "B", "is_internal": true
        }))
        .unwrap(),
    );
    let mut target = post_processing_page("https://example.com/b");
    target.http_status = 404;
    let mut pages = vec![source, target];
    annotate_page_relations(&mut pages, "http");
    assert_eq!(pages[0].links[0].target_http_status, Some(404));
    assert!(pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("internal link target")));
}

#[test]
fn legacy_crawl_snapshots_default_to_http_mode() {
    let legacy = serde_json::json!({
        "start_url": "https://example.com/",
        "pages_crawled": 0,
        "health_score": 100,
        "critical_count": 0,
        "warning_count": 0,
        "notice_count": 0,
        "pages": [],
        "duration_ms": 0,
        "cancelled": false,
        "timed_out": false,
        "robots_txt_status": "unavailable",
        "robots_blocked_count": 0,
        "sitemap_status": "unavailable",
        "sitemap_urls_discovered": 0,
        "sitemap_urls": [],
        "rejected_urls": [],
        "resources": [],
        "resource_limit_reached": false
    });

    let parsed: SiteCrawlResult = serde_json::from_value(legacy).unwrap();

    assert_eq!(parsed.crawl_mode, "http");
    assert!(!parsed.discovery_provenance_truncated);
    assert!(parsed.limit_reasons.is_empty());
}

#[test]
fn discovery_sources_are_deduplicated_and_bounded() {
    let mut sources_by_url = HashMap::new();
    let source = CrawledDiscoverySource {
        kind: "link".into(),
        source_url: Some("https://example.com/guide".into()),
        anchor_text: Some("Guide".into()),
    };

    assert!(record_discovery_source(
        &mut sources_by_url,
        "https://example.com/target",
        source.clone(),
    ));
    assert!(record_discovery_source(
        &mut sources_by_url,
        "https://example.com/target",
        source
    ));
    let mut dropped = false;
    for index in 0..(MAX_DISCOVERY_SOURCES_PER_PAGE + 4) {
        dropped |= !record_discovery_source(
            &mut sources_by_url,
            "https://example.com/target",
            CrawledDiscoverySource {
                kind: "link".into(),
                source_url: Some(format!("https://example.com/source-{index}")),
                anchor_text: None,
            },
        );
    }
    assert!(dropped, "the provenance cap must be observable by callers");

    let sources = sources_by_url
        .get("https://example.com/target")
        .expect("target provenance should be recorded");
    assert_eq!(sources.len(), MAX_DISCOVERY_SOURCES_PER_PAGE);
    assert_eq!(sources[0].anchor_text.as_deref(), Some("Guide"));
}

fn crawl_config_for_test() -> CrawlConfig {
    CrawlConfig {
        crawl_mode: default_http_crawl_mode(),
        render_wait_for_selector: None,
        render_wait_delay_ms: None,
        render_lazy_scroll_cycles: None,
        max_pages: None,
        max_depth: None,
        include_patterns: Vec::new(),
        exclude_patterns: Vec::new(),
        allow_subdomains: false,
        allowed_hosts: Vec::new(),
        scope_path: None,
        keep_query_strings: false,
        respect_robots: true,
        respect_crawl_delay: true,
        discover_sitemaps: true,
        max_redirects: Some(10),
        follow_nofollow: false,
        max_response_bytes: Some(5_000_000),
        max_run_seconds: Some(300),
        request_timeout_secs: None,
        verify_ssl: true,
        seed_urls: Vec::new(),
        list_mode: false,
        user_agent: None,
        request_profile_id: None,
        trim_trailing_slash: false,
        lowercase_path: false,
        strip_tracking_parameters: false,
        allowed_query_parameters: Vec::new(),
        denied_query_parameters: Vec::new(),
        custom_searches: Vec::new(),
        focus_phrase: None,
        crawl_images: false,
        crawl_stylesheets: false,
        crawl_scripts: false,
        crawl_other_resources: false,
        max_resource_requests: Some(250),
        max_concurrent_requests: Some(4),
        resume_completed_urls: Vec::new(),
        resume_frontier_urls: Vec::new(),
    }
}

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
fn duplicate_heading_detection_normalizes_whitespace_and_case_and_keeps_levels() {
    let document = Html::parse_document(
        "<h2> Quick   Start </h2><h3>quick start</h3><h2>QUICK START</h2><h4>Other</h4><h5> </h5>",
    );
    let selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();

    let duplicates = duplicate_heading_groups(&document, &selector);

    assert_eq!(duplicates.len(), 1);
    assert_eq!(duplicates[0].text, "Quick Start");
    assert_eq!(duplicates[0].levels, vec![2, 3]);
    assert_eq!(duplicates[0].occurrences, 3);
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
fn canonical_target_is_resolved_against_the_final_url() {
    let final_url = url::Url::parse("https://example.com/path/page").unwrap();
    assert_eq!(
        final_url.join("/canonical").unwrap().as_str(),
        "https://example.com/canonical"
    );
}

#[test]
fn canonical_classification_reports_missing_declaration() {
    assert_eq!(
        classify_canonical_relation("https://example.com/", 0, &[]),
        "missing"
    );
}

#[test]
fn canonical_extraction_counts_multiple_and_missing_href_declarations() {
    let document = Html::parse_document(
        r#"<link rel="canonical" href="/one"><link rel="alternate canonical">"#,
    );
    let base = url::Url::parse("https://example.com/page").unwrap();
    let (count, targets) = crawl_canonical_declarations(&document, &base);

    assert_eq!(count, 2);
    assert_eq!(targets, vec!["https://example.com/one"]);
    assert_eq!(
        classify_canonical_relation(base.as_str(), count, &targets),
        "multiple"
    );
}

#[test]
fn canonical_extraction_rejects_non_http_and_empty_targets_as_invalid() {
    for markup in [
        r#"<link rel="canonical" href="javascript:alert(1)">"#,
        r#"<link rel="canonical" href="  ">"#,
    ] {
        let document = Html::parse_document(markup);
        let base = url::Url::parse("https://example.com/page").unwrap();
        let (count, targets) = crawl_canonical_declarations(&document, &base);

        assert_eq!(count, 1);
        assert!(targets.is_empty());
        assert_eq!(
            classify_canonical_relation(base.as_str(), count, &targets),
            "invalid"
        );
    }
}

#[test]
fn canonical_classification_ignores_fragment_when_identifying_self_reference() {
    assert_eq!(
        classify_canonical_relation(
            "https://example.com/page?lang=pl",
            1,
            &["https://example.com/page?lang=pl#section".into()]
        ),
        "self"
    );
}

#[test]
fn canonical_identity_normalizes_safe_equivalent_url_spellings() {
    assert_eq!(
        classify_canonical_relation(
            "https://EXAMPLE.com:443/%7Euser",
            1,
            &["https://example.com/~user".into()],
        ),
        "self"
    );
}

#[test]
fn canonical_identity_keeps_reserved_path_escapes_distinct() {
    assert_eq!(
        classify_canonical_relation(
            "https://example.com/a%2Fb",
            1,
            &["https://example.com/a/b".into()],
        ),
        "same-host-other-url"
    );
}

#[test]
fn crawl_url_identity_normalizes_unreserved_escapes_without_sorting_query() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    let encoded = normalize_crawl_url(
        url::Url::parse("https://example.com/%7e?a=2&b=1").unwrap(),
        &config,
    );
    let literal = normalize_crawl_url(
        url::Url::parse("https://example.com/~?a=2&b=1").unwrap(),
        &config,
    );
    assert_eq!(encoded, literal);

    let reordered = normalize_crawl_url(
        url::Url::parse("https://example.com/~?b=1&a=2").unwrap(),
        &config,
    );
    assert_ne!(encoded, reordered);
}

#[test]
fn canonical_classification_distinguishes_other_url_on_same_host() {
    assert_eq!(
        classify_canonical_relation(
            "https://example.com/page",
            1,
            &["https://example.com/canonical".into()]
        ),
        "same-host-other-url"
    );
}

#[test]
fn canonical_classification_distinguishes_a_different_host() {
    assert_eq!(
        classify_canonical_relation(
            "https://example.com/page",
            1,
            &["https://other.example/page".into()]
        ),
        "different-host"
    );
}

#[test]
fn canonical_target_status_is_set_only_when_target_is_in_the_same_run() {
    let statuses = HashMap::from([("https://example.com/canonical".into(), 404)]);
    let mut crawled = CrawledCanonicalTarget {
        url: "https://example.com/canonical".into(),
        relation: "same-host-other-url".into(),
        http_status: None,
        checked_in_run: false,
    };
    let mut not_crawled = CrawledCanonicalTarget {
        url: "https://example.com/outside-run".into(),
        relation: "same-host-other-url".into(),
        http_status: None,
        checked_in_run: false,
    };

    assert_eq!(verify_canonical_target(&mut crawled, &statuses), Some(404));
    assert_eq!(crawled.http_status, Some(404));
    assert!(crawled.checked_in_run);
    assert_eq!(verify_canonical_target(&mut not_crawled, &statuses), None);
    assert_eq!(not_crawled.http_status, None);
    assert!(!not_crawled.checked_in_run);
}

#[test]
fn refresh_declarations_resolve_http_targets_and_preserve_invalid_evidence() {
    let base = url::Url::parse("https://example.com/articles/page").unwrap();
    let meta = parse_client_redirect("meta-refresh", "0; URL='/next'", &base);
    assert_eq!(meta.source, "meta-refresh");
    assert_eq!(meta.delay_seconds, Some(0.0));
    assert_eq!(meta.target_url.as_deref(), Some("https://example.com/next"));

    let header = parse_client_redirect("http-refresh", "5.5; url=\"../new\"", &base);
    assert_eq!(header.delay_seconds, Some(5.5));
    assert_eq!(
        header.target_url.as_deref(),
        Some("https://example.com/new")
    );

    let invalid = parse_client_redirect("http-refresh", "-1; url=javascript:alert(1)", &base);
    assert_eq!(invalid.delay_seconds, None);
    assert_eq!(invalid.target_url, None);
    assert_eq!(invalid.declaration, "-1; url=javascript:alert(1)");
}

#[test]
fn javascript_redirects_capture_literal_targets_without_executing_scripts() {
    let document = Html::parse_document(
        r#"
              <script>window.location.href = '/next';</script>
              <script>location.replace("https://example.com/final");</script>
              <script type="module">location.assign('/module');</script>
              <script>self.location = `/template`; top.location.replace(`https://example.com/template-final`);</script>
              <script type="application/ld+json">{"location":"/not-a-redirect"}</script>
              <script>location.assign(destination); location.href = protocol + '/dynamic';</script>
              <button onclick="location.href='/clicked'">Go</button>
            "#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let redirects = extract_javascript_redirects(&document, &base);

    assert_eq!(redirects.len(), 6);
    assert_eq!(
        redirects
            .iter()
            .filter(|item| item.source == "javascript")
            .count(),
        5
    );
    assert_eq!(
        redirects
            .iter()
            .filter(|item| item.source == "javascript-inline")
            .count(),
        1
    );
    assert_eq!(
        redirects[0].target_url.as_deref(),
        Some("https://example.com/next")
    );
    assert_eq!(
        redirects[1].target_url.as_deref(),
        Some("https://example.com/final")
    );
    assert_eq!(
        redirects[2].target_url.as_deref(),
        Some("https://example.com/module")
    );
    assert_eq!(
        redirects[3].target_url.as_deref(),
        Some("https://example.com/template")
    );
    assert_eq!(
        redirects[4].target_url.as_deref(),
        Some("https://example.com/template-final")
    );
    assert_eq!(
        redirects[5].target_url.as_deref(),
        Some("https://example.com/clicked")
    );
    assert!(redirects[0].declaration.contains("location.href"));
    assert!(redirects[1].declaration.contains("location.replace"));
}

#[test]
fn pagination_extraction_preserves_relations_invalid_declarations_and_query_changes() {
    let document = Html::parse_document(
        r#"<link rel="next" href="?page=2&amp;lang=pl"><a rel="prev" href="?page=0&amp;lang=pl">previous</a><link rel="next"><a rel="prev" href="javascript:alert(1)">broken</a>"#,
    );
    let base = url::Url::parse("https://example.com/articles?page=1&lang=pl").unwrap();
    let (links, declaration_count, invalid_count) = crawl_pagination_links(&document, &base);

    assert_eq!(declaration_count, 4);
    assert_eq!(invalid_count, 2);
    assert_eq!(links.len(), 2);
    assert_eq!(links[0].relation, "next");
    assert_eq!(
        links[0].target_url,
        "https://example.com/articles?page=2&lang=pl"
    );
    assert_eq!(links[0].query_parameter_changes, vec!["page: 1 → 2"]);
    assert_eq!(links[1].relation, "prev");
    assert_eq!(links[1].query_parameter_changes, vec!["page: 1 → 0"]);
}

#[test]
fn pagination_query_changes_preserve_duplicate_parameter_values() {
    let source = url::Url::parse("https://example.com/items?tag=one&tag=two&sort=asc").unwrap();
    let target = url::Url::parse("https://example.com/items?tag=one&tag=three&sort=asc").unwrap();

    assert_eq!(
        pagination_query_changes(&source, &target),
        vec!["tag: one, two → one, three"]
    );
}

#[test]
fn pagination_reciprocity_uses_the_opposite_relation() {
    assert_eq!(opposite_pagination_relation("next"), Some("prev"));
    assert_eq!(opposite_pagination_relation("PREV"), Some("next"));
    assert_eq!(opposite_pagination_relation("alternate"), None);
}

#[test]
fn pagination_canonical_alignment_is_explicit_and_uses_current_page_canonical_signal() {
    assert_eq!(
        pagination_canonical_alignment("self").as_deref(),
        Some("self-canonical")
    );
    assert_eq!(
        pagination_canonical_alignment("same-host-other-url").as_deref(),
        Some("canonical-points-elsewhere")
    );
    assert_eq!(
        pagination_canonical_alignment("missing").as_deref(),
        Some("missing-canonical")
    );
    assert_eq!(pagination_canonical_alignment("unavailable"), None);
}

#[test]
fn pagination_target_status_is_set_only_when_target_is_in_the_same_run() {
    let statuses = HashMap::from([("https://example.com/page/2".into(), 200)]);
    let mut crawled = CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/page/2".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    };
    let mut not_crawled = CrawledPaginationLink {
        relation: "prev".into(),
        target_url: "https://example.com/page/0".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    };

    assert_eq!(verify_pagination_target(&mut crawled, &statuses), Some(200));
    assert_eq!(crawled.http_status, Some(200));
    assert!(crawled.checked_in_run);
    assert_eq!(verify_pagination_target(&mut not_crawled, &statuses), None);
    assert_eq!(not_crawled.http_status, None);
    assert!(!not_crawled.checked_in_run);
}

#[test]
fn duplicate_text_detection_trims_and_normalizes_case_while_ignoring_empty_fields() {
    let duplicates = duplicate_text_indices([
        Some(" Shared description "),
        None,
        Some("shared description"),
        Some(""),
        Some("Different description"),
    ]);

    assert_eq!(duplicates.len(), 1);
    assert_eq!(duplicates[0], vec![0, 2]);
}

#[test]
fn hreflang_language_tags_accept_bcp47_script_region_and_extensions() {
    for valid in [
        "pl",
        "en-GB",
        "zh-Hant-TW",
        "es-419",
        "de-CH-1901",
        "en-a-foo-x-bar",
        "i-klingon",
        "x-default",
    ] {
        assert!(
            is_valid_hreflang_code(valid),
            "expected {valid} to be valid"
        );
    }
    for invalid in ["", "en-", "en-US-US", "en-a", "en-x", "en-abc-def-ghi-jkl"] {
        assert!(
            !is_valid_hreflang_code(invalid),
            "expected {invalid} to be invalid"
        );
    }
}

#[test]
fn hreflang_declarations_report_duplicates_missing_self_and_default() {
    let declarations = vec![
        CrawledHreflang {
            language: "en".into(),
            target_url: "https://example.com/en".into(),
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        },
        CrawledHreflang {
            language: "EN".into(),
            target_url: "https://example.com/en-us".into(),
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        },
    ];
    let issues = validate_hreflang_declarations(
        "https://example.com/pl",
        "https://example.com/pl/",
        &declarations,
    );
    let messages = issues
        .iter()
        .map(|issue| issue.message.as_str())
        .collect::<Vec<_>>();
    assert!(messages
        .iter()
        .any(|message| message.contains("Duplicate hreflang")));
    assert!(messages
        .iter()
        .any(|message| message.contains("self-reference")));
    assert!(messages.iter().any(|message| message.contains("x-default")));
}

#[test]
fn hreflang_declarations_accept_self_reference_to_final_url_and_single_default() {
    let declarations = vec![
        CrawledHreflang {
            language: "pl".into(),
            target_url: "https://example.com/pl/".into(),
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        },
        CrawledHreflang {
            language: "x-default".into(),
            target_url: "https://example.com/".into(),
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        },
    ];
    let issues = validate_hreflang_declarations(
        "https://example.com/pl",
        "https://example.com/pl/",
        &declarations,
    );
    assert!(issues.is_empty());
}

#[test]
fn hreflang_target_annotation_records_status_reciprocity_and_canonical_alignment() {
    let target_url = "https://example.com/en/".to_string();
    let statuses = HashMap::from([(target_url.clone(), 200)]);
    let reciprocal = HashMap::from([(
        target_url.clone(),
        HashSet::from(["https://example.com/pl/".to_string()]),
    )]);
    let canonicals = HashMap::from([(target_url.clone(), Some(target_url.clone()))]);
    let mut target = CrawledHreflang {
        language: "en".into(),
        target_url,
        target_http_status: None,
        target_checked_in_run: false,
        reciprocal_in_run: None,
        target_canonical_alignment: None,
    };

    let issues = annotate_hreflang_target(
        "https://example.com/pl",
        "https://example.com/pl/",
        &mut target,
        &statuses,
        &reciprocal,
        &canonicals,
    );

    assert!(issues.is_empty());
    assert_eq!(target.target_http_status, Some(200));
    assert!(target.target_checked_in_run);
    assert_eq!(target.reciprocal_in_run, Some(true));
    assert_eq!(
        target.target_canonical_alignment.as_deref(),
        Some("self-canonical")
    );
}

#[test]
fn hreflang_target_annotation_reports_broken_nonreciprocal_and_misaligned_target() {
    let target_url = "https://example.com/en/".to_string();
    let statuses = HashMap::from([(target_url.clone(), 404)]);
    let reciprocal = HashMap::from([(target_url.clone(), HashSet::new())]);
    let canonicals = HashMap::from([(
        target_url.clone(),
        Some("https://example.com/en/landing".to_string()),
    )]);
    let mut target = CrawledHreflang {
        language: "en".into(),
        target_url,
        target_http_status: None,
        target_checked_in_run: false,
        reciprocal_in_run: None,
        target_canonical_alignment: None,
    };

    let issues = annotate_hreflang_target(
        "https://example.com/pl",
        "https://example.com/pl/",
        &mut target,
        &statuses,
        &reciprocal,
        &canonicals,
    );

    assert_eq!(target.target_http_status, Some(404));
    assert!(target.target_checked_in_run);
    assert_eq!(target.reciprocal_in_run, Some(false));
    assert_eq!(
        target.target_canonical_alignment.as_deref(),
        Some("canonical-points-elsewhere")
    );
    assert_eq!(issues.len(), 3);
}

#[test]
fn hreflang_target_annotation_keeps_external_targets_explicitly_unverified() {
    let mut target = CrawledHreflang {
        language: "en".into(),
        target_url: "https://outside.example/en/".into(),
        target_http_status: None,
        target_checked_in_run: false,
        reciprocal_in_run: None,
        target_canonical_alignment: None,
    };
    let issues = annotate_hreflang_target(
        "https://example.com/pl",
        "https://example.com/pl/",
        &mut target,
        &HashMap::new(),
        &HashMap::new(),
        &HashMap::new(),
    );

    assert_eq!(target.target_http_status, None);
    assert!(!target.target_checked_in_run);
    assert_eq!(target.reciprocal_in_run, None);
    assert_eq!(target.target_canonical_alignment, None);
    assert!(issues[0].message.contains("not included in this crawl"));
}

#[test]
fn amp_target_verification_returns_status_and_bounded_scope_for_targets_in_the_run() {
    let statuses = HashMap::from([("https://example.com/amp/".into(), 404)]);

    assert_eq!(
        verify_amp_target(
            "https://example.com/",
            "https://example.com/",
            "https://example.com/amp/",
            &statuses,
            &HashMap::new(),
        ),
        (Some(404), None)
    );
    assert_eq!(
        verify_amp_target(
            "https://example.com/",
            "https://example.com/",
            "https://example.com/amp-outside-run/",
            &statuses,
            &HashMap::new(),
        ),
        (None, None)
    );
}

#[test]
fn amp_target_verification_reports_canonical_alignment_from_the_same_run() {
    let statuses = HashMap::from([("https://example.com/amp/".into(), 200)]);
    let source_canonical = HashMap::from([(
        "https://example.com/amp/".into(),
        Some("https://example.com/article".into()),
    )]);
    assert_eq!(
        verify_amp_target(
            "https://example.com/article",
            "https://example.com/article",
            "https://example.com/amp/",
            &statuses,
            &source_canonical,
        ),
        (Some(200), Some("canonical-to-source".into()))
    );

    let self_canonical = HashMap::from([(
        "https://example.com/amp/".into(),
        Some("https://example.com/amp/".into()),
    )]);
    assert_eq!(
        verify_amp_target(
            "https://example.com/article",
            "https://example.com/article",
            "https://example.com/amp/",
            &statuses,
            &self_canonical,
        ),
        (Some(200), Some("self-canonical".into()))
    );
}

#[test]
fn content_metrics_returns_ratio_and_reading_time_for_html() {
    let document = Html::parse_document("<html><body>one two three</body></html>");
    let metrics = content_metrics(&document, 50, Some("en"));
    assert_eq!(metrics.word_count, 3);
    assert!(metrics.text_ratio_percent.is_some_and(|value| value > 0.0));
    assert_eq!(metrics.reading_time_minutes, Some(1));
    assert_eq!(metrics.sentence_count, Some(1));
    assert_eq!(metrics.average_words_per_sentence, Some(3.0));
    assert!(metrics
        .average_characters_per_word
        .is_some_and(|value| value > 3.0));
    assert_eq!(metrics.complexity_score, Some(100));
    assert_eq!(metrics.complexity_label.as_deref(), Some("simple"));
    assert!(metrics.readability_ease_score.is_some());
    assert!(metrics.readability_grade.is_some());
    assert!(metrics.readability_label.is_some());
}

#[test]
fn content_metrics_uses_document_language_for_readability() {
    let document = Html::parse_document(
            "<html lang=\"pl\"><body><main>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</main></body></html>",
        );
    let polish = content_metrics(&document, 220, Some("pl-PL"));
    let english = content_metrics(&document, 220, Some("en-US"));

    assert_eq!(polish.readability_method.as_deref(), Some("flesch-pl"));
    assert_eq!(english.readability_method.as_deref(), Some("flesch-en"));
    assert_ne!(
        polish.readability_ease_score, english.readability_ease_score,
        "Polish text must not silently use the English coefficient"
    );
}

#[test]
fn content_metrics_infers_polish_when_lang_is_missing() {
    let document = Html::parse_document(
            "<html><body><main>To jest tekst, który pokazuje polską treść. Jest to kolejny fragment, który ma lokalny wzór.</main></body></html>",
        );
    let metrics = content_metrics(&document, 220, None);

    assert_eq!(metrics.readability_method.as_deref(), Some("flesch-pl"));
}

#[test]
fn content_metrics_excludes_site_chrome_from_content_signals() {
    let document = Html::parse_document(
            "<html><body><header>navigation words</header><aside>sidebar words</aside><main><p>one two three.</p></main><footer>footer words</footer></body></html>",
        );
    let metrics = content_metrics(&document, 180, Some("en"));

    assert_eq!(metrics.word_count, 3);
    assert_eq!(metrics.sentence_count, Some(1));
    assert_eq!(metrics.average_words_per_sentence, Some(3.0));
    let expected = Html::parse_document("<html><body><main>one two three.</main></body></html>");
    assert_eq!(
        metrics.content_hash,
        normalized_content_fingerprint(&expected).1
    );
}

#[test]
fn content_metrics_reports_bounded_term_density() {
    let document = Html::parse_document(
            "<html><body><header>espresso navigation</header><main>espresso espresso brewing coffee</main><footer>espresso footer</footer></body></html>",
        );
    let metrics = content_metrics(&document, 150, Some("en"));

    assert_eq!(
        metrics.content_terms.first().map(|term| term.term.as_str()),
        Some("espresso")
    );
    assert_eq!(
        metrics.content_terms.first().map(|term| term.count),
        Some(2)
    );
    assert!(metrics
        .content_terms
        .first()
        .is_some_and(|term| (term.density_percent - 50.0).abs() < 0.01));
    assert!(!metrics
        .content_terms
        .iter()
        .any(|term| term.term == "navigation"));
}

#[test]
fn focus_phrase_evidence_reports_content_and_metadata_locations() {
    let document = Html::parse_document(
            "<html><head><title>Technical SEO audit</title><meta name=\"description\" content=\"Technical SEO audit guide\"></head><body><header>Technical SEO audit navigation</header><main><h1>Technical SEO audit</h1><p>Technical SEO audit helps teams find issues.</p></main></body></html>",
        );
    let evidence = focus_phrase_evidence(
        &document,
        Some("Technical SEO audit"),
        Some("Technical SEO audit guide"),
        Some("technical seo audit"),
    )
    .expect("phrase evidence should be available");

    assert_eq!(evidence.body_occurrences, 2);
    assert_eq!(evidence.title_occurrences, 1);
    assert_eq!(evidence.meta_description_occurrences, 1);
    assert_eq!(evidence.h1_occurrences, 1);
    assert!(evidence.body_density_percent > 0.0);
}

#[test]
fn semantic_extraction_uses_main_content_and_excludes_site_chrome() {
    let document = Html::parse_document(
        r#"<html><body><header><nav><a href="/global">globalnavigation</a></nav></header><aside class="sidebar">sidebarkeyword</aside><main><h1>Espresso brewing</h1><article><p>Espresso brewing requires precise grinding and fresh coffee beans.</p><a href="/grinding">grinding guide</a></article><form><label>formkeyword</label></form><div role="search">searchformkeyword</div><footer>footerkeyword</footer></main><footer>sitefooterkeyword</footer></body></html>"#,
    );
    let terms = extract_semantic_terms(&document);
    let excerpts = extract_semantic_excerpts(&document);
    assert!(terms.contains(&"espresso".to_string()));
    assert!(terms.contains(&"grinding".to_string()));
    assert!(excerpts
        .iter()
        .any(|excerpt| excerpt.contains("Espresso brewing requires precise grinding")));
    assert!(!terms.contains(&"globalnavigation".to_string()));
    assert!(!terms.contains(&"sidebarkeyword".to_string()));
    assert!(!terms.contains(&"footerkeyword".to_string()));
    assert!(!terms.contains(&"formkeyword".to_string()));
    assert!(!terms.contains(&"searchformkeyword".to_string()));
    assert!(!excerpts
        .iter()
        .any(|excerpt| excerpt.contains("globalnavigation")));
    assert!(!excerpts
        .iter()
        .any(|excerpt| excerpt.contains("footerkeyword")));
    assert!(!terms.contains(&"sitefooterkeyword".to_string()));

    let anchor_selector = Selector::parse("a").unwrap();
    let anchors = document.select(&anchor_selector).collect::<Vec<_>>();
    assert!(!semantic_content_contains(&anchors[0], true));
    assert!(semantic_content_contains(&anchors[1], true));

    let fallback_document = Html::parse_document(
        r#"<html><body><header>globalheaderterm</header><nav>globalnavigationterm</nav><div class="sidebar">sidebarkeyword</div><p>Fallback article content discusses espresso machines and coffee extraction.</p><footer>globalfooterterm</footer></body></html>"#,
    );
    let fallback_terms = extract_semantic_terms(&fallback_document);
    let fallback_excerpts = extract_semantic_excerpts(&fallback_document);
    assert!(fallback_terms.contains(&"espresso".to_string()));
    assert!(fallback_excerpts
        .iter()
        .any(|excerpt| excerpt.contains("Fallback article content discusses espresso")));
    assert!(!fallback_terms.contains(&"globalheaderterm".to_string()));
    assert!(!fallback_terms.contains(&"globalnavigationterm".to_string()));
    assert!(!fallback_terms.contains(&"sidebarkeyword".to_string()));
    assert!(!fallback_terms.contains(&"globalfooterterm".to_string()));
}

#[test]
fn link_source_excerpt_is_bounded_and_redacts_values_and_handlers() {
    let document = Html::parse_document(
        r#"<html><body><main><a href="/broken" value="secret-value" onclick="sendSecret()">Broken destination</a></main></body></html>"#,
    );
    let anchor = document
        .select(&Selector::parse("a").unwrap())
        .next()
        .expect("anchor fixture should exist");
    let excerpt = bounded_link_source_excerpt(&anchor).expect("excerpt should exist");
    assert!(excerpt.contains("/broken"));
    assert!(excerpt.contains("[redacted]"));
    assert!(!excerpt.contains("secret-value"));
    assert!(!excerpt.contains("sendSecret"));
    assert!(excerpt.chars().count() <= 800);
}

#[test]
fn semantic_extraction_handles_rendered_dom_visibility_and_dynamic_chrome() {
    // This mirrors the HTML captured after a browser-rendered page has
    // hydrated. Dynamic content belongs to <main>; consent/navigation
    // fragments and hidden app shells must not influence semantic terms,
    // excerpts, or content-only graph links.
    let rendered_dom = r#"
            <html><body>
              <header><p>headerchromemarker</p></header>
              <nav><a href="/nav">navchromemarker</a></nav>
              <aside><p>sidebarchromemarker</p></aside>
              <div class="cookie-consent"><p>consentchromemarker</p></div>
              <main>
                <h1>Dynamic semantic content</h1>
                <p>Hydrated content about technical audits and crawl diagnostics.</p>
                <a href="/guide">Read the crawl diagnostics guide</a>
                <div hidden><p>hiddeninjectedmarker</p><a href="/hidden">hidden link</a></div>
                <div inert><p>inertinjectedmarker</p><a href="/inert">inert link</a></div>
                <div aria-hidden="1"><p>ariahiddenmarker</p><a href="/aria-hidden">aria hidden link</a></div>
                <div style="display:none!important"><p>displaynonemarker</p><a href="/display-none">display none link</a></div>
                <div style="visibility: hidden"><p>visibilityhiddenmarker</p><a href="/visibility-hidden">visibility hidden link</a></div>
                <div style="content-visibility:hidden"><p>contenthiddenmarker</p><a href="/content-hidden">content hidden link</a></div>
              </main>
              <footer><p>dynamic footer keyword</p></footer>
            </body></html>
        "#;
    let document = Html::parse_document(rendered_dom);
    let terms = extract_semantic_terms(&document);
    let excerpts = extract_semantic_excerpts(&document);
    assert!(terms.contains(&"hydrated".to_string()));
    assert!(terms.contains(&"diagnostics".to_string()));
    for excluded in [
        "headerchromemarker",
        "navchromemarker",
        "sidebarchromemarker",
        "consentchromemarker",
        "hiddeninjectedmarker",
        "inertinjectedmarker",
        "ariahiddenmarker",
        "displaynonemarker",
        "visibilityhiddenmarker",
        "contenthiddenmarker",
    ] {
        assert!(!terms.contains(&excluded.to_string()), "{excluded}");
    }
    assert!(excerpts
        .iter()
        .any(|excerpt| excerpt.contains("Hydrated content about technical audits")));
    assert!(!excerpts
        .iter()
        .any(|excerpt| excerpt.contains("hiddeninjectedmarker")));

    let anchor_selector = Selector::parse("a").unwrap();
    let anchors = document.select(&anchor_selector).collect::<Vec<_>>();
    assert!(anchors
        .iter()
        .any(|anchor| anchor.value().attr("href") == Some("/guide")
            && semantic_content_contains(anchor, true)));
    for hidden_href in [
        "/nav",
        "/hidden",
        "/inert",
        "/aria-hidden",
        "/display-none",
        "/visibility-hidden",
        "/content-hidden",
    ] {
        let anchor = anchors
            .iter()
            .find(|anchor| anchor.value().attr("href") == Some(hidden_href))
            .expect("fixture link should exist");
        assert!(!semantic_content_contains(anchor, true), "{hidden_href}");
    }
    assert_eq!(
        semantic_content_source(&document, true, false, false),
        "primary-root"
    );
}

#[test]
fn hidden_primary_root_does_not_suppress_visible_body_fallback() {
    let document = Html::parse_document(
        r#"<html><body><main hidden><p>hidden primary root term</p></main><div><p>Visible fallback article content.</p></div></body></html>"#,
    );
    assert!(!has_semantic_content_root(&document));
    let terms = extract_semantic_terms(&document);
    assert!(terms.contains(&"visible".to_string()));
    assert!(!terms.contains(&"hidden".to_string()));
    assert_eq!(
        semantic_content_source(&document, true, false, false),
        "body-fallback"
    );
}

#[test]
fn semantic_source_identifies_primary_fallback_and_unavailable_documents() {
    let primary =
        Html::parse_document("<html><body><main><p>Rendered content</p></main></body></html>");
    assert_eq!(
        semantic_content_source(&primary, true, false, false),
        "primary-root"
    );

    let fallback = Html::parse_document(
        "<html><body><div><p>Rendered fallback content</p></div></body></html>",
    );
    assert_eq!(
        semantic_content_source(&fallback, true, false, false),
        "body-fallback"
    );

    assert_eq!(
        semantic_content_source(&primary, false, false, false),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&primary, true, true, false),
        "unavailable"
    );
    assert_eq!(
        semantic_content_source(&primary, true, false, true),
        "unavailable"
    );
}

#[test]
fn semantic_provenance_distinguishes_rendered_and_http_snapshots() {
    assert_eq!(
        semantic_provenance_for_mode("browser-rendered", "primary-root"),
        "rendered"
    );
    assert_eq!(
        semantic_provenance_for_mode("http", "body-fallback"),
        "http"
    );
    assert_eq!(
        semantic_provenance_for_mode("browser-rendered", "unavailable"),
        "unavailable"
    );
}

#[test]
fn semantic_partial_flag_is_conservative_at_each_bound() {
    assert!(!semantic_content_is_partial(false, false, 39, 7, 999));
    assert!(semantic_content_is_partial(true, false, 0, 0, 0));
    assert!(semantic_content_is_partial(false, true, 0, 0, 0));
    assert!(semantic_content_is_partial(false, false, 40, 0, 0));
    assert!(semantic_content_is_partial(false, false, 0, 8, 0));
    assert!(semantic_content_is_partial(false, false, 0, 0, 1_000));
}

#[test]
fn scope_respects_subdomain_setting() {
    let child = url::Url::parse("https://docs.example.com/guide").unwrap();
    assert!(!matches_scope(&child, "example.com", false, None, &[]));
    assert!(matches_scope(&child, "example.com", true, None, &[]));
}

#[test]
fn scope_limits_crawling_to_the_selected_directory() {
    let kept = url::Url::parse("https://example.com/docs/guide").unwrap();
    let excluded = url::Url::parse("https://example.com/blog/post").unwrap();
    let near_match = url::Url::parse("https://example.com/docs-old").unwrap();
    assert!(matches_scope(
        &kept,
        "example.com",
        false,
        Some("/docs"),
        &[]
    ));
    assert!(!matches_scope(
        &excluded,
        "example.com",
        false,
        Some("/docs"),
        &[]
    ));
    assert!(!matches_scope(
        &near_match,
        "example.com",
        false,
        Some("/docs"),
        &[]
    ));
}

#[test]
fn scope_accepts_only_explicitly_allowlisted_hosts() {
    let external = url::Url::parse("https://docs.partner.example/guide").unwrap();
    let allowlist = vec!["docs.partner.example".to_string()];
    assert!(matches_scope(
        &external,
        "example.com",
        false,
        Some("/private"),
        &allowlist
    ));
    assert!(!matches_scope(
        &url::Url::parse("https://unknown.partner.example/guide").unwrap(),
        "example.com",
        false,
        None,
        &allowlist
    ));
}

#[test]
fn allowlisted_hosts_are_normalized_and_invalid_entries_are_rejected() {
    let hosts = normalize_allowed_hosts(&[
        " HTTPS://Docs.Example.com/ ".to_string(),
        "docs.example.com".to_string(),
    ])
    .unwrap();
    assert_eq!(hosts, vec!["docs.example.com"]);
    assert!(normalize_allowed_hosts(&["docs.example.com/path".to_string()]).is_err());
}

#[test]
fn filters_require_include_and_reject_exclude() {
    let include = vec![Regex::new("/docs/").unwrap()];
    let exclude = vec![Regex::new("private").unwrap()];
    assert!(matches_filters(
        "https://example.com/docs/guide",
        &include,
        &exclude
    ));
    assert!(!matches_filters(
        "https://example.com/blog/post",
        &include,
        &exclude
    ));
    assert!(!matches_filters(
        "https://example.com/docs/private",
        &include,
        &exclude
    ));
}

#[test]
fn url_normalization_applies_explicit_path_and_query_rules_in_a_stable_order() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.trim_trailing_slash = true;
    config.lowercase_path = true;
    config.strip_tracking_parameters = true;
    config.allowed_query_parameters = vec!["page".into(), "lang".into(), "gclid".into()];
    config.denied_query_parameters = vec!["lang".into()];

    let source = url::Url::parse(
        "https://example.com/Docs/Guide/?utm_source=newsletter&page=2&lang=pl&gclid=test#section",
    )
    .unwrap();
    let normalized = normalize_crawl_url(source, &config);

    assert_eq!(normalized.as_str(), "https://example.com/docs/guide?page=2");
}

#[test]
fn url_normalization_keeps_the_existing_default_of_dropping_all_query_parameters() {
    let source = url::Url::parse("https://example.com/docs/?page=2#section").unwrap();
    let normalized = normalize_crawl_url(source, &crawl_config_for_test());

    assert_eq!(normalized.as_str(), "https://example.com/docs/");
}

#[test]
fn url_normalization_collapses_default_ports_and_host_trailing_dots() {
    let https = url::Url::parse("HTTPS://Example.COM.:443/guide").unwrap();
    let http = url::Url::parse("http://Example.COM:80/guide").unwrap();

    assert_eq!(
        normalize_crawl_url(https, &crawl_config_for_test()).as_str(),
        "https://example.com/guide"
    );
    assert_eq!(
        normalize_crawl_url(http, &crawl_config_for_test()).as_str(),
        "http://example.com/guide"
    );
}

#[test]
fn srcset_parser_preserves_candidate_commas_inside_data_urls_and_reads_descriptors() {
    let urls = parse_srcset_urls(
        "small.webp 1x, https://cdn.example.test/large.webp 2x, data:image/svg+xml,%3Csvg,%3E 3x",
    );

    assert_eq!(
        urls,
        vec![
            "small.webp",
            "https://cdn.example.test/large.webp",
            "data:image/svg+xml,%3Csvg,%3E",
        ]
    );
}

#[test]
fn html_decoder_honors_http_charset_and_reports_invalid_byte_sequences() {
    let (decoded, charset, findings) =
        decode_crawl_html_body(b"<p>caf\xe9</p>", Some("windows-1252"));

    assert!(decoded.contains("café"));
    assert_eq!(charset.as_deref(), Some("windows-1252"));
    assert!(findings.is_empty());

    let (_, _, findings) = decode_crawl_html_body(b"<p>\xff</p>", Some("utf-8"));
    assert_eq!(findings[0].code, "encoding-invalid-byte-sequence");
    assert_eq!(findings[0].line, Some(1));
    assert!(findings[0]
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains('�')));
}

#[test]
fn html_decoder_reports_unknown_charset_and_uses_utf8_fallback() {
    let (decoded, charset, findings) =
        decode_crawl_html_body(b"<p>ok</p>", Some("not-a-real-charset"));

    assert!(decoded.contains("ok"));
    assert_eq!(charset.as_deref(), Some("UTF-8"));
    assert_eq!(findings[0].code, "encoding-unsupported-label");
    assert!(findings[0].line.is_none());
}

#[test]
fn html_decoder_uses_in_document_charset_when_http_does_not_declare_one() {
    let body = b"<meta charset=windows-1252><p>caf\xe9</p>";
    let (decoded, charset, findings) = decode_crawl_html_body(body, None);

    assert!(decoded.contains("café"));
    assert_eq!(charset.as_deref(), Some("windows-1252"));
    assert!(findings.is_empty());
}

#[test]
fn html_decoder_locates_unsupported_in_document_charset() {
    let body = b"<html>\n<head><meta charset='not-a-real-charset'></head>\n</html>";
    let (_, charset, findings) = decode_crawl_html_body(body, None);

    assert_eq!(charset.as_deref(), Some("UTF-8"));
    assert_eq!(findings[0].code, "encoding-unsupported-label");
    assert_eq!(findings[0].line, Some(2));
    assert!(findings[0]
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("charset='not-a-real-charset'")));
}

#[test]
fn html_validation_reports_missing_doctype_duplicate_ids_and_malformed_uris() {
    let markup = r#"<html>
<body>
<div id="same"></div>
<span id="same"></span><a href="/bad%ZZ">Link</a>
</body></html>"#;
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (findings, truncated) = validate_crawl_html_with_charset(&document, markup, &base, None);

    assert!(!truncated);
    assert!(findings
        .iter()
        .any(|finding| finding.code == "html-doctype-missing"));
    let doctype = findings
        .iter()
        .find(|finding| finding.code == "html-doctype-missing")
        .unwrap();
    assert_eq!(doctype.line, Some(1));
    assert_eq!(doctype.column, Some(1));
    assert!(doctype
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<html>")));
    let duplicate_id = findings
        .iter()
        .find(|finding| finding.code == "html-duplicate-id")
        .unwrap();
    assert_eq!(duplicate_id.line, Some(4));
    assert!(duplicate_id.column.is_some());
    assert!(duplicate_id
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("id=\"same\"")));
    let malformed_uri = findings
        .iter()
        .find(|finding| finding.code == "html-uri-invalid")
        .unwrap();
    assert_eq!(malformed_uri.attribute.as_deref(), Some("href"));
    assert_eq!(malformed_uri.value.as_deref(), Some("/bad%ZZ"));
    assert_eq!(malformed_uri.line, Some(4));
    assert!(malformed_uri.column.is_some());
}

#[test]
fn html_validation_reports_missing_language_and_charset_with_source_evidence() {
    let markup =
        "<!doctype html>\n<html>\n<head><title>Test</title></head>\n<body>ok</body>\n</html>";
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (findings, truncated) = validate_crawl_html_with_charset(&document, markup, &base, None);

    assert!(!truncated);
    let language = findings
        .iter()
        .find(|finding| finding.code == "html-lang-missing")
        .expect("missing lang finding");
    assert_eq!(language.element.as_deref(), Some("html"));
    assert_eq!(language.attribute.as_deref(), Some("lang"));
    assert_eq!(language.line, Some(2));
    assert!(language
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<html>")));

    let charset = findings
        .iter()
        .find(|finding| finding.code == "html-meta-charset-missing")
        .expect("missing charset finding");
    assert_eq!(charset.element.as_deref(), Some("meta"));
    assert_eq!(charset.attribute.as_deref(), Some("charset"));
    assert_eq!(charset.line, Some(3));
    assert!(charset
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<head>")));
}

#[test]
fn html_validation_accepts_meta_charset_variants_and_http_charset() {
    let base = url::Url::parse("https://example.com/page").unwrap();
    for markup in [
            "<!doctype html><html lang='pl'><head><meta charset='utf-8'></head><body></body></html>",
            "<!doctype html><html lang='pl'><head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'></head><body></body></html>",
        ] {
            let document = Html::parse_document(markup);
            let (findings, _) = validate_crawl_html_with_charset(&document, markup, &base, None);
            assert!(!findings
                .iter()
                .any(|finding| finding.code == "html-meta-charset-missing"));
            assert!(!findings
                .iter()
                .any(|finding| finding.code == "html-lang-missing"));
        }

    let markup = "<!doctype html><html lang='pl'><head><title>HTTP charset</title></head><body></body></html>";
    let document = Html::parse_document(markup);
    let (findings, _) = validate_crawl_html_with_charset(&document, markup, &base, Some("utf-8"));
    assert!(!findings
        .iter()
        .any(|finding| finding.code == "html-meta-charset-missing"));
}

#[test]
fn html_validation_distinguishes_invalid_and_duplicate_doctypes() {
    let base = url::Url::parse("https://example.com/page").unwrap();
    let invalid_markup = "<!doctype svg><html lang='en'><head><meta charset='utf-8'></head></html>";
    let invalid_document = Html::parse_document(invalid_markup);
    let (invalid_findings, _) =
        validate_crawl_html_with_charset(&invalid_document, invalid_markup, &base, None);
    assert!(invalid_findings
        .iter()
        .any(|finding| finding.code == "html-doctype-invalid"));
    assert!(!invalid_findings
        .iter()
        .any(|finding| finding.code == "html-doctype-missing"));

    let duplicate_markup = "<!doctype html>\n<!doctype html>\n<html lang='en'><head><meta charset='utf-8'></head></html>";
    let duplicate_document = Html::parse_document(duplicate_markup);
    let (duplicate_findings, _) =
        validate_crawl_html_with_charset(&duplicate_document, duplicate_markup, &base, None);
    let duplicate = duplicate_findings
        .iter()
        .find(|finding| finding.code == "html-doctype-duplicate")
        .expect("duplicate doctype finding");
    assert_eq!(duplicate.line, Some(2));
    assert!(duplicate
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<!doctype html>")));
    assert!(!duplicate_findings
        .iter()
        .any(|finding| finding.code == "html-doctype-invalid"));
}

#[test]
fn resource_crawl_only_enables_explicitly_selected_resource_types() {
    let mut config = crawl_config_for_test();
    config.crawl_images = true;
    config.crawl_scripts = true;

    assert!(resource_type_enabled("image", &config));
    assert!(resource_type_enabled("script", &config));
    assert!(!resource_type_enabled("stylesheet", &config));
    assert!(!resource_type_enabled("other", &config));
    assert!(is_other_resource_url(
        &url::Url::parse("https://example.com/files/report.pdf").unwrap()
    ));
    assert!(!is_other_resource_url(
        &url::Url::parse("https://example.com/article").unwrap()
    ));
}

#[test]
fn inline_image_dimensions_are_bounded_and_local_only() {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    png[16..20].copy_from_slice(&2u32.to_be_bytes());
    png[20..24].copy_from_slice(&3u32.to_be_bytes());
    let png_uri = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png));
    assert_eq!(inline_image_dimensions(&png_uri), Some((2, 3)));
    assert_eq!(inline_image_format(&png_uri).as_deref(), Some("png"));

    let gif_uri = "data:image/gif;base64,R0lGODlhBAAFAAAA";
    assert_eq!(inline_image_dimensions(gif_uri), Some((4, 5)));
    let svg_uri = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20120%2060%22%3E%3C/svg%3E";
    assert_eq!(inline_image_dimensions(svg_uri), Some((120, 60)));
    let svg_attributes = "data:image/svg+xml,<svg width=\"80\" height=\"40\"></svg>";
    assert_eq!(inline_image_dimensions(svg_attributes), Some((80, 40)));
    let percentage_svg = "data:image/svg+xml,%3Csvg%20width%3D%22100%25%22%20height%3D%2250%25%22%20viewBox%3D%220%200%2080%2040%22%3E%3C/svg%3E";
    assert_eq!(inline_image_dimensions(percentage_svg), Some((80, 40)));
    assert!(inline_image_dimensions("https://example.com/image.png").is_none());
    let oversized = format!("data:image/png;base64,{}", "A".repeat(2_000_001));
    assert!(inline_image_dimensions(&oversized).is_none());
    assert!(
        bounded_inline_image_uri(&format!("data:image/png,{}", "x".repeat(9_000))).len()
            > MAX_INLINE_IMAGE_URI_CHARS
    );
}

#[test]
fn fetched_image_dimensions_decode_bounded_supported_formats_without_retaining_body() {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    png[16..20].copy_from_slice(&7u32.to_be_bytes());
    png[20..24].copy_from_slice(&9u32.to_be_bytes());
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/png"), &png),
        Some((7, 9))
    );

    let gif = b"GIF89a\x04\x00\x05\x00\x00\x00";
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/gif"), gif),
        Some((4, 5))
    );

    let mut webp = vec![0u8; 30];
    webp[0..4].copy_from_slice(b"RIFF");
    webp[8..12].copy_from_slice(b"WEBP");
    webp[12..16].copy_from_slice(b"VP8X");
    webp[24..27].copy_from_slice(&49u32.to_le_bytes()[..3]);
    webp[27..30].copy_from_slice(&39u32.to_le_bytes()[..3]);
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/webp"), &webp),
        Some((50, 40))
    );

    let jpeg = [
        0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x32, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00,
    ];
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/jpeg"), &jpeg),
        Some((100, 50))
    );

    let svg = br#"<svg viewBox="0 0 120 60"></svg>"#;
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/svg+xml"), svg),
        Some((120, 60))
    );

    let mut oversized = vec![0u8; MAX_INTRINSIC_IMAGE_BYTES + 1];
    oversized[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    assert!(intrinsic_http_image_dimensions(Some("image/png"), &oversized).is_none());
}

#[test]
fn image_inventory_uses_only_matching_resource_responses_and_keeps_unknowns_unknown() {
    let config = crawl_config_for_test();
    let mut images = vec![
        CrawledImage {
            src: "https://example.com/photo.webp?version=2".into(),
            alt: Some("Photo".into()),
            srcset: None,
            format: Some("webp".into()),
            width: Some(640),
            height: Some(480),
            dimensions_source: Some("attributes".into()),
            lazy_loaded: false,
            checked_in_run: false,
            http_status: None,
            content_length: None,
            request_error_kind: None,
            srcset_resource_checks: vec![
                CrawledImageResourceCheck {
                    url: "https://example.com/responsive.webp?width=2".into(),
                    checked_in_run: false,
                    http_status: None,
                    content_length: None,
                    request_error_kind: None,
                },
                CrawledImageResourceCheck {
                    url: "https://outside.example/responsive.webp".into(),
                    checked_in_run: false,
                    http_status: None,
                    content_length: None,
                    request_error_kind: None,
                },
            ],
            srcset_resource_checks_truncated: false,
        },
        CrawledImage {
            src: "https://example.com/not-requested.webp".into(),
            alt: None,
            srcset: None,
            format: Some("webp".into()),
            width: None,
            height: None,
            dimensions_source: None,
            lazy_loaded: true,
            checked_in_run: false,
            http_status: None,
            content_length: None,
            request_error_kind: None,
            srcset_resource_checks: Vec::new(),
            srcset_resource_checks_truncated: false,
        },
    ];
    let resources = [
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/photo.webp".into(),
            resource_type: "image".into(),
            http_status: Some(404),
            content_type: Some("image/webp".into()),
            content_length: Some(1234),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(42),
            request_error_kind: None,
        },
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/responsive.webp".into(),
            resource_type: "image".into(),
            http_status: Some(200),
            content_type: Some("image/webp".into()),
            content_length: Some(2048),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(63),
            request_error_kind: None,
        },
    ];

    apply_checked_image_resources(&mut images, &resources, &config);

    assert!(images[0].checked_in_run);
    assert_eq!(images[0].http_status, Some(404));
    assert_eq!(images[0].content_length, Some(1234));
    assert!(images[0].srcset_resource_checks[0].checked_in_run);
    assert_eq!(images[0].srcset_resource_checks[0].http_status, Some(200));
    assert_eq!(
        images[0].srcset_resource_checks[0].content_length,
        Some(2048)
    );
    assert!(!images[0].srcset_resource_checks[1].checked_in_run);
    assert!(!images[1].checked_in_run);
    assert_eq!(images[1].http_status, None);
    assert_eq!(images[1].content_length, None);

    let fetched_dimensions = [CrawledResource {
        source_urls: vec!["https://example.com/page".into()],
        url: "https://example.com/not-requested.webp".into(),
        resource_type: "image".into(),
        http_status: Some(200),
        content_type: Some("image/webp".into()),
        content_length: Some(800),
        intrinsic_width: Some(320),
        intrinsic_height: Some(180),
        dimensions_source: Some("intrinsic-http".into()),
        response_time_ms: Some(11),
        request_error_kind: None,
    }];
    apply_checked_image_resources(&mut images, &fetched_dimensions, &config);
    assert_eq!(images[1].width, Some(320));
    assert_eq!(images[1].height, Some(180));
    assert_eq!(
        images[1].dimensions_source.as_deref(),
        Some("intrinsic-http")
    );
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
fn robots_rules_prefer_the_longest_matching_rule() {
    let rules = parse_robots_rules(
        "User-agent: seomi\nDisallow: /private\nAllow: /private/public\n",
        "seomi",
    );
    assert!(!robots_allows(
        &url::Url::parse("https://example.com/private/one").unwrap(),
        &rules
    ));
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private/public/page").unwrap(),
        &rules
    ));
}

#[test]
fn robots_decision_combines_meta_and_header_tokens_with_sources() {
    let decision = build_robots_decision(Some("index, nofollow"), Some("googlebot: noindex"), true);

    assert_eq!(decision.indexability, "noindex");
    assert_eq!(decision.link_following, "nofollow");
    assert_eq!(decision.directives, vec!["index", "nofollow", "noindex"]);
    assert_eq!(decision.sources, vec!["meta robots", "X-Robots-Tag"]);
    assert!(decision.response_headers_available);
}

#[test]
fn indexability_verdict_is_typed_and_explains_each_blocking_signal() {
    let blocked = build_indexability_verdict(200, "http", true, false, true, true, false);
    assert_eq!(blocked.status, "blocked");
    assert_eq!(
        blocked.reasons,
        vec![
            "robots_noindex",
            "canonical_points_elsewhere",
            "robots_nofollow"
        ]
    );

    let rendered =
        build_indexability_verdict(200, "browser-rendered", false, false, false, false, false);
    assert_eq!(rendered.status, "uncertain");
    assert_eq!(rendered.reasons, vec!["x_robots_header_unavailable"]);

    let redirect = build_indexability_verdict(301, "http", false, false, false, false, false);
    assert_eq!(redirect.status, "uncertain");
    assert_eq!(redirect.reasons, vec!["redirect_response"]);
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
fn robots_rules_allow_equal_length_ties() {
    let rules = parse_robots_rules(
        "User-agent: seomi\nDisallow: /private\nAllow: /private\n",
        "seomi",
    );
    let url = url::Url::parse("https://example.com/private").unwrap();

    assert!(robots_allows(&url, &rules));
    assert!(robots_deciding_rule(&url, &rules).unwrap().allow);
}

#[test]
fn robots_rules_match_escaped_and_human_readable_paths() {
    let rules = parse_robots_rules(
        "User-agent: seomi\nDisallow: /private%20area/$\nDisallow: /search?q=summer%20sale\n",
        "seomi",
    );
    let escaped_path = url::Url::parse("https://example.com/private%20area/").unwrap();
    let readable_path = url::Url::parse("https://example.com/private area/").unwrap();
    let escaped_query = url::Url::parse("https://example.com/search?q=summer%20sale").unwrap();

    assert!(!robots_allows(&escaped_path, &rules));
    assert!(!robots_allows(&readable_path, &rules));
    assert!(!robots_allows(&escaped_query, &rules));
}

#[test]
fn robots_path_matching_keeps_invalid_percent_escapes_literal() {
    let rules = parse_robots_rules("User-agent: *\nDisallow: /bad%ZZ\n", "seomi");
    let matching = url::Url::parse("https://example.com/bad%ZZ").unwrap();
    let different = url::Url::parse("https://example.com/bad-value").unwrap();

    assert!(!robots_allows(&matching, &rules));
    assert!(robots_allows(&different, &rules));
}

#[test]
fn robots_specific_agent_group_overrides_the_wildcard_group() {
    let rules = parse_robots_rules(
        "User-agent: *\nDisallow: /\nUser-agent: SEOmiDesktopBot\nAllow: /public\n",
        "SEOmiDesktopBot/1.0",
    );

    assert_eq!(rules.len(), 1);
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private").unwrap(),
        &rules
    ));
    assert!(robots_allows(
        &url::Url::parse("https://example.com/public").unwrap(),
        &rules
    ));
}

#[test]
fn robots_agent_matrix_keeps_specific_groups_and_wildcard_fallbacks_separate() {
    let matrix = build_robots_agent_matrix(
        "User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /ai\nCrawl-delay: 2\n",
        "SEOmiDesktopBot/1.0",
    );
    let desktop = matrix
        .iter()
        .find(|entry| entry.user_agent == "SEOmiDesktopBot/1.0")
        .expect("effective user-agent is included");
    assert!(!desktop.specific_group);
    assert_eq!(desktop.applicable_rules[0].directive, "disallow");

    let gpt = matrix
        .iter()
        .find(|entry| entry.user_agent == "GPTBot")
        .expect("GPTBot is included");
    assert!(gpt.specific_group);
    assert_eq!(gpt.applicable_rules[0].directive, "allow");
    assert_eq!(gpt.crawl_delay_ms, Some(2_000));
}

#[test]
fn robots_rules_support_wildcards_and_end_anchors() {
    let rules = parse_robots_rules(
        "User-agent: *\nDisallow: /private/*/secret$\n",
        "SEOmiDesktopBot/1.0",
    );

    assert!(!robots_allows(
        &url::Url::parse("https://example.com/private/a/secret").unwrap(),
        &rules
    ));
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private/a/secret/more").unwrap(),
        &rules
    ));
}

#[test]
fn robots_parser_ignores_empty_disallow_and_preserves_sitemap_directives() {
    let content =
        "User-agent: *\nDisallow:\nAllow: /public\nSitemap: https://example.com/sitemap.xml\n";
    let rules = parse_robots_rules(content, "SEOmiDesktopBot/1.0");

    assert_eq!(rules.len(), 1);
    assert!(robots_allows(
        &url::Url::parse("https://example.com/private").unwrap(),
        &rules
    ));
    assert_eq!(
        parse_sitemap_directives(content),
        vec!["https://example.com/sitemap.xml"]
    );
}

#[test]
fn robots_crawl_delay_is_parsed_for_the_active_agent_and_capped() {
    let delay = parse_robots_crawl_delay("User-agent: seomi\nCrawl-delay: 1.5\n", "seomi").unwrap();
    let capped_delay =
        parse_robots_crawl_delay("User-agent: *\nCrawl-delay: 999\n", "seomi").unwrap();

    assert_eq!(delay, std::time::Duration::from_millis(1_500));
    assert_eq!(capped_delay, std::time::Duration::from_secs(60));
}

#[test]
fn extracts_locations_from_urlset_and_sitemap_index() {
    let locations = parse_sitemap_locations("<urlset><url><loc>https://example.com/a</loc></url><sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap></urlset>");
    assert_eq!(
        locations,
        vec!["https://example.com/a", "https://example.com/sitemap-2.xml"]
    );
}

#[test]
fn normalizes_whitespace_and_case_when_fingerprinting_content() {
    let first = Html::parse_document("<html><body>Hello   WORLD</body></html>");
    let second = Html::parse_document("<html><body>hello world</body></html>");
    assert_eq!(
        normalized_content_fingerprint(&first),
        normalized_content_fingerprint(&second)
    );
}

#[test]
fn simhash_near_duplicate_pairs_use_a_visible_hamming_threshold() {
    let pairs = near_duplicate_pairs(&[
        (0, "0000000000000000".into()),
        (1, "0000000000000003".into()),
        (2, "ffffffffffffffff".into()),
    ]);

    assert_eq!(pairs, vec![(0, 1, 2)]);
    assert_eq!(
        simhash_distance("0000000000000000", "0000000000000003"),
        Some(2)
    );
}

#[test]
fn simhash_is_stable_for_normalized_document_text() {
    let first = Html::parse_document("<html><body>One TWO three four five six</body></html>");
    let second = Html::parse_document("<html><body>one two   three four five six</body></html>");

    assert_eq!(content_simhash(&first), content_simhash(&second));
}

#[test]
fn discovers_json_ld_types_in_top_level_and_graph() {
    let value: serde_json::Value = serde_json::from_str(
        r#"{"@type":"WebSite","@graph":[{"@type":["Organization","Thing"]}]}"#,
    )
    .unwrap();
    let mut types = Vec::new();
    collect_json_ld_types(&value, &mut types);
    assert_eq!(types, vec!["WebSite", "Organization", "Thing"]);
}

#[test]
fn crawl_schema_inventory_includes_static_validation_findings_for_all_formats() {
    let document = Html::parse_document(
        r#"<html><head>
              <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":" ","offers":null}</script>
              <script type="application/ld+json">{invalid json}</script>
            </head><body>
              <div itemscope itemtype="Product"><span itemprop="name">Example</span></div>
              <div vocab="relative-vocab" typeof="Article" property="headline">Example</div>
            </body></html>"#,
    );

    let (types, syntax_errors, findings, references, truncated) = inspect_page_schema(&document);
    assert!(types.contains(&"Product".to_string()));
    assert!(types.contains(&"Article".to_string()));
    assert!(references.is_empty());
    assert_eq!(syntax_errors, 1);
    assert!(!truncated);
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "product-name-empty-or-invalid"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "product-related-property-shape-invalid"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "jsonld-syntax-invalid"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "microdata-itemtype-not-absolute"));
    assert!(findings
        .iter()
        .any(|item| item.finding.code == "rdfa-vocab-not-absolute"));
    let serialized = serde_json::to_value(&findings[0]).expect("finding should serialize");
    assert!(serialized.get("finding").is_some());
}

#[test]
fn schema_inventory_retains_only_bounded_declared_identifiers_and_relations() {
    let document = Html::parse_document(
        r#"<html><head>
              <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"Organization","@id":"https://example.com/#org","url":"https://example.com/","sameAs":["https://social.example/acme",{"@id":"https://example.com/about"}],"publisher":{"@id":"https://example.com/#org"}}
              </script>
            </head><body>
              <div itemscope itemtype="https://schema.org/Article" itemid="https://example.com/article#item" itemref="author-node"></div>
              <div vocab="https://schema.org" typeof="Article"><a property="author" resource="https://example.com/author">Author</a></div>
            </body></html>"#,
    );

    let (_, _, _, references, truncated) = inspect_page_schema(&document);
    assert!(!truncated);
    assert!(references.iter().any(|reference| {
        reference.format == "JSON-LD"
            && reference.property == "@id"
            && reference.value == "https://example.com/#org"
    }));
    assert!(references.iter().any(|reference| {
        reference.format == "Microdata"
            && reference.property == "itemref"
            && reference.value == "author-node"
    }));
    assert!(references.iter().any(|reference| {
        reference.format == "RDFa"
            && reference.property == "author"
            && reference.value == "https://example.com/author"
    }));
    assert_eq!(
        references
            .iter()
            .filter(|reference| reference.property == "publisher")
            .count(),
        0,
        "nested objects without explicit @id/url must not become invented references"
    );
}

#[test]
fn crawl_social_metadata_collects_open_graph_and_twitter_tags_only() {
    let document = Html::parse_document(
        r#"<html><head>
              <meta property="og:title" content="Actual title">
              <meta property="og:description" content="Actual description">
              <meta name="twitter:card" content="summary_large_image">
              <meta name="description" content="Not a social-card tag">
            </head></html>"#,
    );
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(tags.len(), 3);
    assert_eq!(tags[0].key, "og:title");
    assert_eq!(tags[0].content.as_deref(), Some("Actual title"));
    assert_eq!(tags[2].key, "twitter:card");
}

#[test]
fn crawl_favicon_metadata_preserves_declaration_attributes_and_deduplicates() {
    let document = Html::parse_document(
        r#"<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
              <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
              <link rel="shortcut icon" href="/favicon.ico">
              <link rel="stylesheet" href="/app.css">"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let favicons = crawl_favicon_metadata(&document, &base);

    assert_eq!(favicons.len(), 2);
    assert_eq!(favicons[0].href, "https://example.com/favicon.svg");
    assert_eq!(favicons[0].rel, "icon");
    assert_eq!(favicons[0].declared_type.as_deref(), Some("image/svg+xml"));
    assert_eq!(favicons[0].declared_sizes.as_deref(), Some("any"));
    assert_eq!(favicons[0].inferred_format.as_deref(), Some("svg"));
    assert_eq!(favicons[1].rel, "shortcut icon");
    assert_eq!(favicons[1].inferred_format.as_deref(), Some("ico"));
}

#[test]
fn crawl_frames_resolves_http_targets_and_preserves_frame_attributes() {
    let document = Html::parse_document(
        r#"<iframe src="../embed?id=1" title="Video" name="player" loading="lazy" sandbox="allow-scripts"></iframe>
              <iframe srcdoc="<p>inline</p>"></iframe>
              <iframe src="javascript:alert(1)"></iframe>
              <iframe></iframe>"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let (frames, truncated) = crawl_frames(&document, &base);

    assert!(!truncated);
    assert_eq!(frames.len(), 4);
    assert_eq!(frames[0].src.as_deref(), Some("../embed?id=1"));
    assert_eq!(
        frames[0].resolved_url.as_deref(),
        Some("https://example.com/embed?id=1")
    );
    assert_eq!(frames[0].title.as_deref(), Some("Video"));
    assert_eq!(frames[0].name.as_deref(), Some("player"));
    assert_eq!(frames[0].loading.as_deref(), Some("lazy"));
    assert_eq!(frames[0].sandbox.as_deref(), Some("allow-scripts"));
    assert!(frames[1..].iter().all(|frame| frame.resolved_url.is_none()));
}

#[test]
fn crawl_social_metadata_normalizes_keys_but_preserves_duplicate_declarations() {
    let document = Html::parse_document(
        r#"<meta property="OG:TITLE" content="First"><meta property="og:title" content="Second">"#,
    );
    let base = url::Url::parse("https://example.com/").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(tags.len(), 2);
    assert!(tags.iter().all(|tag| tag.key == "og:title"));
    assert_eq!(tags[0].content.as_deref(), Some("First"));
    assert_eq!(tags[1].content.as_deref(), Some("Second"));
}

#[test]
fn crawl_social_metadata_resolves_declared_social_urls_against_final_url() {
    let document = Html::parse_document(
        r#"<meta property="og:url" content="../canonical"><meta property="og:image" content="/social.png"><meta name="twitter:image" content="images/card.jpg">"#,
    );
    let base = url::Url::parse("https://example.com/folder/page").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(
        tags[0].content.as_deref(),
        Some("https://example.com/canonical")
    );
    assert_eq!(
        tags[1].content.as_deref(),
        Some("https://example.com/social.png")
    );
    assert_eq!(
        tags[2].content.as_deref(),
        Some("https://example.com/folder/images/card.jpg")
    );
}

#[test]
fn crawl_social_metadata_distinguishes_missing_content_from_empty_content() {
    let document = Html::parse_document(
        r#"<meta property="og:title"><meta property="og:description" content="">"#,
    );
    let base = url::Url::parse("https://example.com/").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(tags[0].content, None);
    assert_eq!(tags[1].content.as_deref(), Some(""));
}

#[test]
fn crawl_social_metadata_discovers_and_deduplicates_http_favicons() {
    let document = Html::parse_document(
        r#"<link rel="shortcut icon" href="/favicon.ico"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="icons/touch.png"><link rel="icon" href="javascript:alert(1)"><link rel="alternate" href="feed.xml">"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let (favicons, _) = crawl_social_metadata(&document, &base);

    assert_eq!(
        favicons,
        vec![
            "https://example.com/favicon.ico",
            "https://example.com/articles/icons/touch.png"
        ]
    );
}

#[test]
fn crawl_social_metadata_creates_unchecked_records_for_declared_image_resources() {
    let document = Html::parse_document(
        r#"<meta property="og:image" content="../share.webp"><meta property="og:image:width" content="1200"><meta name="twitter:image:src" content="https://cdn.example.test/card.png"><meta property="og:title" content="A title">"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    let og_image = tags.iter().find(|tag| tag.key == "og:image").unwrap();
    assert_eq!(
        og_image.content.as_deref(),
        Some("https://example.com/share.webp")
    );
    let check = og_image.resource_check.as_ref().unwrap();
    assert_eq!(check.url, "https://example.com/share.webp");
    assert!(!check.checked_in_run);
    assert_eq!(check.http_status, None);
    let twitter_image = tags
        .iter()
        .find(|tag| tag.key == "twitter:image:src")
        .unwrap();
    assert!(twitter_image.resource_check.is_some());
    let width = tags.iter().find(|tag| tag.key == "og:image:width").unwrap();
    assert!(width.resource_check.is_none());
    let title = tags.iter().find(|tag| tag.key == "og:title").unwrap();
    assert!(title.resource_check.is_none());
}

#[test]
fn optional_social_image_requests_respect_image_enablement_and_crawl_scope() {
    let base = url::Url::parse("https://example.com/articles/page").unwrap();
    let mut config = crawl_config_for_test();
    let mut candidates = HashMap::new();
    add_resource_candidate(
        &mut candidates,
        "https://example.com/articles/page",
        &base,
        "https://example.com/articles/share.png",
        "image",
        "example.com",
        &config,
    );
    assert!(candidates.is_empty());

    config.crawl_images = true;
    add_resource_candidate(
        &mut candidates,
        "https://example.com/articles/page",
        &base,
        "https://example.com/articles/share.png",
        "image",
        "example.com",
        &config,
    );
    add_resource_candidate(
        &mut candidates,
        "https://example.com/articles/page",
        &base,
        "https://cdn.example.net/share.png",
        "image",
        "example.com",
        &config,
    );
    assert_eq!(candidates.len(), 1);
    assert_eq!(
        candidates.values().next().unwrap().url,
        "https://example.com/articles/share.png"
    );
}

#[test]
fn checked_social_resources_keep_http_status_content_type_and_size() {
    let config = crawl_config_for_test();
    let mut checks = vec![
        unchecked_social_resource("https://example.com/favicon.ico"),
        unchecked_social_resource("https://example.com/social.png"),
        unchecked_social_resource("https://example.com/not-checked.png"),
    ];
    let resources = [
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/favicon.ico".into(),
            resource_type: "image".into(),
            http_status: Some(200),
            content_type: Some("image/x-icon".into()),
            content_length: Some(321),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(12),
            request_error_kind: None,
        },
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/social.png".into(),
            resource_type: "image".into(),
            http_status: Some(404),
            content_type: Some("text/html".into()),
            content_length: Some(82),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(34),
            request_error_kind: None,
        },
    ];
    let checked_images = resources
        .iter()
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();

    apply_checked_social_resource_checks(&mut checks, &checked_images, &config);

    assert!(checks[0].checked_in_run);
    assert_eq!(checks[0].http_status, Some(200));
    assert_eq!(checks[0].content_type.as_deref(), Some("image/x-icon"));
    assert_eq!(checks[0].content_length, Some(321));
    assert_eq!(checks[1].http_status, Some(404));
    assert_eq!(checks[1].content_length, Some(82));
    assert!(!checks[2].checked_in_run);
    assert_eq!(checks[2].http_status, None);
}

#[test]
fn crawl_social_metadata_keeps_http_links_but_does_not_resolve_non_http_social_values() {
    let document = Html::parse_document(
        r#"<meta property="og:image" content="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AA==">"#,
    );
    let base = url::Url::parse("https://example.com/").unwrap();

    let (favicons, tags) = crawl_social_metadata(&document, &base);

    assert!(favicons.is_empty());
    assert_eq!(tags[0].content.as_deref(), Some("javascript:alert(1)"));
}
