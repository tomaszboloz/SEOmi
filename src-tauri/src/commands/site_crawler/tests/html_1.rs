use super::*;

#[test]
fn html_decoder_honors_http_charset_and_reports_invalid_byte_sequences() {
    let (decoded, charset, findings) =
        decode_crawl_html_body(b"<p>caf\xe9</p>", Some("windows-1252"));

    assert!(decoded.contains("café"));
    assert_eq!(charset.as_deref(), Some("windows-1252"));
    assert!(findings.is_empty());

    let (_, _, findings) = decode_crawl_html_body(b"<p>\xff</p>", Some("utf-8"));
    assert_eq!(findings[0].code, "encoding-invalid-byte-sequence");
    assert_eq!(findings[0].line, Some(1));
    assert!(findings[0]
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains('�')));
}

#[test]
fn html_decoder_reports_unknown_charset_and_uses_utf8_fallback() {
    let (decoded, charset, findings) =
        decode_crawl_html_body(b"<p>ok</p>", Some("not-a-real-charset"));

    assert!(decoded.contains("ok"));
    assert_eq!(charset.as_deref(), Some("UTF-8"));
    assert_eq!(findings[0].code, "encoding-unsupported-label");
    assert!(findings[0].line.is_none());
}

#[test]
fn html_decoder_uses_in_document_charset_when_http_does_not_declare_one() {
    let body = b"<meta charset=windows-1252><p>caf\xe9</p>";
    let (decoded, charset, findings) = decode_crawl_html_body(body, None);

    assert!(decoded.contains("café"));
    assert_eq!(charset.as_deref(), Some("windows-1252"));
    assert!(findings.is_empty());
}

#[test]
fn html_decoder_locates_unsupported_in_document_charset() {
    let body = b"<html>\n<head><meta charset='not-a-real-charset'></head>\n</html>";
    let (_, charset, findings) = decode_crawl_html_body(body, None);

    assert_eq!(charset.as_deref(), Some("UTF-8"));
    assert_eq!(findings[0].code, "encoding-unsupported-label");
    assert_eq!(findings[0].line, Some(2));
    assert!(findings[0]
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("charset='not-a-real-charset'")));
}

#[test]
fn html_validation_reports_missing_doctype_duplicate_ids_and_malformed_uris() {
    let markup = r#"<html>
<body>
<div id="same"></div>
<span id="same"></span><a href="/bad%ZZ">Link</a>
</body></html>"#;
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (findings, truncated) = validate_crawl_html_with_charset(&document, markup, &base, None);

    assert!(!truncated);
    assert!(findings
        .iter()
        .any(|finding| finding.code == "html-doctype-missing"));
    let doctype = findings
        .iter()
        .find(|finding| finding.code == "html-doctype-missing")
        .unwrap();
    assert_eq!(doctype.line, Some(1));
    assert_eq!(doctype.column, Some(1));
    assert!(doctype
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<html>")));
    let duplicate_id = findings
        .iter()
        .find(|finding| finding.code == "html-duplicate-id")
        .unwrap();
    assert_eq!(duplicate_id.line, Some(4));
    assert!(duplicate_id.column.is_some());
    assert!(duplicate_id
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("id=\"same\"")));
    let malformed_uri = findings
        .iter()
        .find(|finding| finding.code == "html-uri-invalid")
        .unwrap();
    assert_eq!(malformed_uri.attribute.as_deref(), Some("href"));
    assert_eq!(malformed_uri.value.as_deref(), Some("/bad%ZZ"));
    assert_eq!(malformed_uri.line, Some(4));
    assert!(malformed_uri.column.is_some());
}

#[test]
fn html_validation_reports_missing_language_and_charset_with_source_evidence() {
    let markup =
        "<!doctype html>\n<html>\n<head><title>Test</title></head>\n<body>ok</body>\n</html>";
    let document = Html::parse_document(markup);
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (findings, truncated) = validate_crawl_html_with_charset(&document, markup, &base, None);

    assert!(!truncated);
    let language = findings
        .iter()
        .find(|finding| finding.code == "html-lang-missing")
        .expect("missing lang finding");
    assert_eq!(language.element.as_deref(), Some("html"));
    assert_eq!(language.attribute.as_deref(), Some("lang"));
    assert_eq!(language.line, Some(2));
    assert!(language
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<html>")));

    let charset = findings
        .iter()
        .find(|finding| finding.code == "html-meta-charset-missing")
        .expect("missing charset finding");
    assert_eq!(charset.element.as_deref(), Some("meta"));
    assert_eq!(charset.attribute.as_deref(), Some("charset"));
    assert_eq!(charset.line, Some(3));
    assert!(charset
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<head>")));
}
