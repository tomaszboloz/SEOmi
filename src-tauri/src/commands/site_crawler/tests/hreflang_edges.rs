use super::*;

fn declaration(language: &str, target_url: &str) -> CrawledHreflang {
    CrawledHreflang {
        language: language.into(),
        target_url: target_url.into(),
        target_http_status: None,
        target_checked_in_run: false,
        reciprocal_in_run: None,
        target_canonical_alignment: None,
    }
}

#[test]
fn hreflang_declarations_report_invalid_language_and_multiple_defaults() {
    let source = "https://example.test/pl";
    let issues = validate_hreflang_declarations(
        source,
        "https://example.test/pl/",
        &[
            declaration("en_US", source),
            declaration("x-default", "https://example.test/"),
            declaration("X-DEFAULT", "https://example.test/global"),
        ],
    );

    assert!(issues
        .iter()
        .any(|issue| issue.message.contains("Invalid hreflang")));
    assert!(issues
        .iter()
        .any(|issue| issue.message.contains("More than one x-default")));
    assert!(!issues
        .iter()
        .any(|issue| issue.message.contains("self-reference")));
}

#[test]
fn hreflang_annotation_keeps_status_zero_reciprocity_and_unknown_canonical_explicit() {
    let source = "https://example.test/pl";
    let target_url = "https://example.test/en".to_string();
    let mut target = declaration("en", &target_url);
    let issues = annotate_hreflang_target(
        source,
        "https://example.test/pl/",
        &mut target,
        &HashMap::from([(target_url.clone(), 0)]),
        &HashMap::from([(target_url.clone(), HashSet::from([source.to_string()]))]),
        &HashMap::new(),
    );

    assert!(issues.iter().any(|issue| issue.message.contains("HTTP 0")));
    assert_eq!(target.target_http_status, Some(0));
    assert_eq!(target.reciprocal_in_run, Some(true));
    assert_eq!(target.target_canonical_alignment, None);
}

#[test]
fn hreflang_accepts_a_primary_language_longer_than_three_letters() {
    assert!(is_valid_hreflang_code("abcd"));
}
