use super::*;

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
