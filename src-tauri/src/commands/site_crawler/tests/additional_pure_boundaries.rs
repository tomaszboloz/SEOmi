use super::*;

#[test]
fn social_metadata_skips_empty_and_malformed_icon_references() {
    let document = Html::parse_document(
        r#"<link rel="icon" href=""><link rel="mask-icon" href="http://[">
           <link rel="icon" href="/ok.ico">"#,
    );
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (favicons, _) = crawl_social_metadata(&document, &base);

    assert_eq!(favicons, ["https://example.com/ok.ico"]);
}

#[test]
fn resource_candidates_reject_bad_urls_and_cap_source_provenance() {
    let mut config = crawl_config_for_test();
    config.crawl_images = true;
    let base = url::Url::parse("https://example.com/page").unwrap();
    let mut candidates = HashMap::new();

    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "http://[",
        "image",
        "example.com",
        &config,
    );
    assert!(candidates.is_empty());

    for index in 0..101 {
        add_resource_candidate(
            &mut candidates,
            &format!("https://example.com/source-{index}"),
            &base,
            "logo.png",
            "image",
            "example.com",
            &config,
        );
    }
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates.values().next().unwrap().source_urls.len(), 100);
}

#[test]
fn url_normalization_handles_default_ports_hostless_urls_and_hex_letters() {
    let config = crawl_config_for_test();
    let normalized = normalize_crawl_url(
        url::Url::parse("https://Example.com:443/%41").unwrap(),
        &config,
    );
    assert_eq!(normalized.as_str(), "https://example.com/A");

    let hostless = normalize_crawl_url(
        url::Url::parse("mailto:author@example.com").unwrap(),
        &config,
    );
    assert_eq!(hostless.as_str(), "mailto:author@example.com");
}

#[test]
fn phrase_boundaries_return_no_evidence_without_a_phrase_or_body_tokens() {
    assert_eq!(phrase_occurrences("Target target", "   "), 0);
    assert_eq!(infer_content_language("punctuation-only text"), None);

    let empty_body = Html::parse_document("<main>   </main>");
    let evidence = focus_phrase_evidence(&empty_body, None, None, Some("target")).unwrap();
    assert_eq!(evidence.body_occurrences, 0);
    assert_eq!(evidence.body_density_percent, 0.0);
    assert_eq!(evidence.title_occurrences, 0);
    assert_eq!(evidence.meta_description_occurrences, 0);
    assert!(focus_phrase_evidence(&empty_body, None, None, Some("  ")).is_none());
}

#[test]
fn scoring_handles_empty_finding_keys_and_failed_evidence() {
    let mut failed = post_processing_page("https://example.com/file");
    failed.request_error_kind = Some("timeout".into());
    assert_eq!(score_pages(&[failed]).health_score, 50);

    let mut blank_finding = post_processing_page("https://example.com/page");
    blank_finding.issues.push(CrawledPageIssue {
        severity: "Warning".into(),
        message: "   ".into(),
    });
    let score = score_pages(&[blank_finding]);
    assert_eq!(score.warning_count, 1);
    assert_eq!(score.health_score, 90);
}

#[test]
fn amp_status_zero_is_reported_as_a_broken_observed_target() {
    let mut source = post_processing_page("https://example.com/page");
    source.amp_url = Some("https://example.com/page/amp".into());
    let mut amp = post_processing_page("https://example.com/page/amp");
    amp.http_status = 0;
    let mut pages = vec![source, amp];

    annotate_page_relations(&mut pages, "http");

    assert_eq!(pages[0].amp_target_http_status, Some(0));
    assert!(pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("AMP target returned HTTP 0")));
    assert_eq!(pages[0].issues_count, pages[0].issues.len());
}
