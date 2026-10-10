use super::*;

fn validate(markup: &str) -> (Vec<CrawledHtmlValidationFinding>, bool) {
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.test/base/page").unwrap();
    let mut findings = Vec::new();
    let mut truncated = false;
    validate_element_attributes(
        &document,
        markup,
        &markup.to_ascii_lowercase(),
        &base,
        &mut findings,
        &mut truncated,
    );
    (findings, truncated)
}

#[test]
fn attribute_validation_skips_fragments_templates_and_allowed_schemes() {
    let markup = r##"<a href="#section">fragment</a>
        <a href="{{route}}">template</a><a href="${url}">template</a>
        <a href="<% url %>">template</a>
        <a href="mailto:test@example.test">mail</a><a href="tel:+48123">tel</a>
        <a href="javascript:void(0)">js</a><a href="data:text/plain,ok">data</a>
        <a href="blob:https://example.test/id">blob</a>
        <a href="about:blank">about</a><a href="ftp://example.test/file">ftp</a>"##;
    let (findings, truncated) = validate(markup);
    assert!(findings.is_empty());
    assert!(!truncated);
}

#[test]
fn attribute_validation_reports_malformed_uris_and_duplicate_ids_with_source() {
    let markup = r#"<div id="same"></div>
        <span id='same' href="bad uri"></span>
        <a href="/bad%ZZ">bad</a><img src="http://[">"#;
    let (findings, truncated) = validate(markup);
    assert!(!truncated);
    assert_eq!(
        findings
            .iter()
            .filter(|item| item.code == "html-uri-invalid")
            .count(),
        3
    );
    let duplicate = findings
        .iter()
        .find(|item| item.code == "html-duplicate-id")
        .expect("duplicate id finding");
    assert_eq!(duplicate.line, Some(2));
    assert!(duplicate.column.is_some());
    assert!(duplicate
        .source_excerpt
        .as_deref()
        .unwrap()
        .contains("same"));
}

#[test]
fn attribute_validation_keeps_each_bad_uri_occurrence_and_applies_page_caps() {
    let markup = (0..(MAX_HTML_VALIDATION_FINDINGS_PER_PAGE + 1))
        .map(|index| format!("<a href=\"bad uri {index}\">x</a>"))
        .collect::<String>();
    let (findings, truncated) = validate(&markup);
    assert!(truncated);
    assert_eq!(findings.len(), MAX_HTML_VALIDATION_FINDINGS_PER_PAGE);
    assert!(findings.iter().all(|item| item.code == "html-uri-invalid"));
    assert!(findings
        .windows(2)
        .all(|pair| pair[0].source_excerpt != pair[1].source_excerpt));
}
