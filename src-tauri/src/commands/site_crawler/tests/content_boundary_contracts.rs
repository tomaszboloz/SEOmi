use super::*;

#[test]
fn punctuation_only_content_has_no_fabricated_readability_or_complexity() {
    let document = Html::parse_document("<main><p>... !!! ???</p></main>");
    let metrics = content_metrics(&document, 0, Some("en"));
    // The crawl inventory counts whitespace tokens; readability excludes punctuation.
    assert_eq!(metrics.word_count, 3);
    assert_eq!(metrics.sentence_count, Some(0));
    assert_eq!(metrics.text_ratio_percent, None);
    assert_eq!(metrics.average_words_per_sentence, None);
    assert_eq!(metrics.average_characters_per_word, None);
    assert_eq!(metrics.complexity_score, None);
    assert_eq!(metrics.readability_ease_score, None);
    assert_eq!(metrics.readability_grade, None);
    assert_eq!(metrics.readability_method, None);
    assert!(metrics.content_terms.is_empty());
}

#[test]
fn empty_charset_declarations_do_not_invent_an_encoding_label() {
    for body in [
        b"<meta charset=''>".as_slice(),
        b"<meta charset= >",
        b"charset",
        b"charset not-a-value",
    ] {
        assert_eq!(html_meta_charset(body), None);
        let (decoded, encoding, findings) = decode_crawl_html_body(body, None);
        assert_eq!(decoded.as_bytes(), body);
        assert_eq!(encoding.as_deref(), Some("UTF-8"));
        assert!(findings.is_empty());
    }
}

#[test]
fn unknown_http_charset_is_reported_without_claiming_document_source_location() {
    let (decoded, encoding, findings) = decode_crawl_html_body(b"<p>Hello</p>", Some("'unknown'"));
    assert_eq!(decoded, "<p>Hello</p>");
    assert_eq!(encoding.as_deref(), Some("UTF-8"));
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].code, "encoding-unsupported-label");
    assert_eq!(findings[0].line, None);
    assert_eq!(findings[0].source_excerpt, None);
}

#[test]
fn literal_redirect_cap_preserves_first_declarations_and_ignores_later_events() {
    let mut markup = (0..40)
        .map(|index| format!("<script>location.assign('/literal-{index}')</script>"))
        .collect::<String>();
    markup.push_str("<button onclick=\"location='/after-cap'\">Go</button>");
    let redirects = extract_javascript_redirects(
        &Html::parse_document(&markup),
        &url::Url::parse("https://example.test/").unwrap(),
    );
    assert_eq!(redirects.len(), 32);
    assert_eq!(
        redirects[0].target_url.as_deref(),
        Some("https://example.test/literal-0")
    );
    assert_eq!(
        redirects[31].target_url.as_deref(),
        Some("https://example.test/literal-31")
    );
    assert!(redirects
        .iter()
        .all(|redirect| redirect.source == "javascript"));
}
