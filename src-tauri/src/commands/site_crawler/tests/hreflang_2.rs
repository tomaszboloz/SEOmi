use super::*;

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
