use super::*;

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
fn amp_annotation_preserves_alignment_and_reports_only_observed_failures() {
    for (canonical, alignment) in [
        (None, "missing-canonical"),
        (
            Some("https://elsewhere.example"),
            "canonical-points-elsewhere",
        ),
        (Some("https://example.com/a"), "canonical-to-source"),
    ] {
        let mut source = post_processing_page("https://example.com/a");
        source.amp_url = Some("https://example.com/amp".into());
        let mut amp = post_processing_page("https://example.com/amp");
        amp.http_status = 404;
        amp.canonical = canonical.map(str::to_string);
        let mut pages = vec![source, amp];
        annotate_page_relations(&mut pages, "http");
        assert_eq!(pages[0].amp_target_http_status, Some(404));
        assert!(pages[0].amp_target_checked_in_run);
        assert_eq!(
            pages[0].amp_target_canonical_alignment.as_deref(),
            Some(alignment)
        );
        assert!(pages[0]
            .issues
            .iter()
            .any(|issue| issue.message.contains("AMP target returned HTTP 404")));
        assert_eq!(pages[0].issues_count, pages[0].issues.len());
    }
    let mut source = post_processing_page("https://example.com/a");
    source.amp_url = Some("https://example.com/not-crawled".into());
    let mut pages = vec![source];
    annotate_page_relations(&mut pages, "http");
    assert_eq!(pages[0].amp_target_http_status, None);
    assert!(!pages[0].amp_target_checked_in_run);
    assert!(pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("AMP target was not included")));
}
