use super::*;

#[test]
fn fragment_html_reports_accessibility_metadata_with_fallback_source_evidence() {
    let markup = "<body>fragment content</body>";
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.test/page").unwrap();
    let (findings, truncated) = validate_crawl_html_with_charset(&document, markup, &base, None);

    assert!(!truncated);
    for code in ["html-lang-missing", "html-meta-charset-missing"] {
        let finding = findings
            .iter()
            .find(|item| item.code == code)
            .expect("accessibility metadata finding");
        assert_eq!(finding.line, Some(1));
        assert!(finding
            .source_excerpt
            .as_deref()
            .unwrap()
            .contains("<body>"));
    }
}

#[test]
fn html_attribute_findings_remain_valid_without_matching_source_text() {
    let markup = r#"<div id="same"></div><div id="same"></div><a href="/bad%ZZ">bad</a>"#;
    let document = Html::parse_document(markup);
    let mut findings = Vec::new();
    let mut truncated = false;
    validate_element_attributes(
        &document,
        "different source",
        "different source",
        &url::Url::parse("https://example.test/page").unwrap(),
        &mut findings,
        &mut truncated,
    );

    assert!(!truncated);
    assert!(findings
        .iter()
        .filter(|item| item.code == "html-duplicate-id" || item.code == "html-uri-invalid")
        .all(|item| item.line.is_none() && item.source_excerpt.is_none()));
}

#[test]
fn html_attribute_validation_stops_after_the_uri_safety_budget() {
    let markup = (0..20_001)
        .map(|index| format!("<a href=\"/asset-{index}\">x</a>"))
        .collect::<String>();
    let document = Html::parse_document(&markup);
    let mut findings = Vec::new();
    let mut truncated = false;
    validate_element_attributes(
        &document,
        &markup,
        &markup.to_ascii_lowercase(),
        &url::Url::parse("https://example.test/page").unwrap(),
        &mut findings,
        &mut truncated,
    );

    assert!(truncated);
    assert!(findings.is_empty());
}

#[test]
fn percent_encoding_and_source_locator_edges() {
    use super::html_source_locator::{
        is_valid_percent_encoding, push_html_validation_finding, set_html_finding_source,
    };

    // 1. is_valid_percent_encoding branches
    assert!(!is_valid_percent_encoding("abc%"));
    assert!(!is_valid_percent_encoding("abc%a"));
    assert!(!is_valid_percent_encoding("abc%G1"));
    assert!(!is_valid_percent_encoding("abc%1G"));
    assert!(is_valid_percent_encoding("abc%20def%2f"));
    assert!(is_valid_percent_encoding("normal-text"));

    // 2. set_html_finding_source with multibyte utf8
    let mut finding = CrawledHtmlValidationFinding {
        code: "test".into(),
        severity: "warning".into(),
        message: "test message".into(),
        element: None,
        attribute: None,
        value: None,
        line: None,
        column: None,
        source_excerpt: None,
    };
    let multibyte = "zażółć gęślą jaźń \n".repeat(20);
    set_html_finding_source(&mut finding, &multibyte, 105);
    assert!(finding.line.is_some());
    assert!(finding.column.is_some());
    assert!(finding.source_excerpt.is_some());

    // 3. push_html_validation_finding truncation
    let mut findings = (0..MAX_HTML_VALIDATION_FINDINGS_PER_PAGE)
        .map(|_| finding.clone())
        .collect::<Vec<_>>();
    let mut truncated = false;
    push_html_validation_finding(&mut findings, &mut truncated, finding);
    assert!(truncated);
}
