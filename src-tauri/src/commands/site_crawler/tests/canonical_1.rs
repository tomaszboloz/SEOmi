use super::*;

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
