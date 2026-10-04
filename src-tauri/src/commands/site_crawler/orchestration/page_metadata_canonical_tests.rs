use super::*;

fn canonical_result(html: &str) -> (PageCanonicalOutcome, Vec<CrawledPageIssue>) {
    let document = Html::parse_document(html);
    let base = Url::parse("https://example.test/page").unwrap();
    let mut issues = Vec::new();
    let result = extract_page_canonical(&document, &base, base.as_str(), true, 0, 0, &mut issues);
    (result, issues)
}

#[test]
fn invalid_canonical_declarations_remain_observed_and_never_become_http_targets() {
    for html in [
        "<link rel='canonical'>",
        "<link rel='canonical' href=' '>",
        "<link rel='canonical' href='javascript:alert(1)'>",
        "<link rel='canonical' href='https://[bad'>",
    ] {
        let (result, issues) = canonical_result(html);
        assert_eq!(result.canonical_declaration_count, 1, "{html}");
        assert_eq!(result.canonical_relation, "invalid", "{html}");
        assert!(result.canonical_targets.is_empty(), "{html}");
        assert_eq!(result.canonical, None);
        assert!(issues.iter().any(|issue| issue.message
            == "Canonical declaration has a missing, invalid, or non-HTTP URL"));
    }
}

#[test]
fn mixed_valid_and_invalid_declarations_preserve_the_multiple_verdict() {
    let (result, issues) =
        canonical_result("<link rel='alternate CANONICAL' href='/page'><link rel='canonical'>");
    assert_eq!(result.canonical_declaration_count, 2);
    assert_eq!(result.canonical_relation, "multiple");
    assert_eq!(result.canonical_targets.len(), 1);
    assert_eq!(result.canonical_targets[0].url, "https://example.test/page");
    assert!(issues
        .iter()
        .any(|issue| issue.message == "Multiple canonical links found (2)"));
}

#[test]
fn absent_declarations_and_self_targets_keep_existing_diagnostics() {
    let (missing, issues) = canonical_result("<title>Page</title>");
    assert_eq!(missing.canonical_declaration_count, 0);
    assert_eq!(missing.canonical_relation, "missing");
    assert!(issues
        .iter()
        .any(|issue| issue.message == "Missing canonical link"));
    let (result, issues) = canonical_result("<link rel='canonical' href='/page#section'>");
    assert_eq!(result.canonical_declaration_count, 1);
    assert_eq!(result.canonical_relation, "self");
    assert!(!result.canonical_points_elsewhere);
    assert!(issues.is_empty());
}
