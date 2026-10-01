use super::*;

#[test]
fn html_validation_accepts_meta_charset_variants_and_http_charset() {
    let base = url::Url::parse("https://example.com/page").unwrap();
    for markup in [
            "<!doctype html><html lang='pl'><head><meta charset='utf-8'></head><body></body></html>",
            "<!doctype html><html lang='pl'><head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'></head><body></body></html>",
        ] {
            let document = Html::parse_document(markup);
            let (findings, _) = validate_crawl_html_with_charset(&document, markup, &base, None);
            assert!(!findings
                .iter()
                .any(|finding| finding.code == "html-meta-charset-missing"));
            assert!(!findings
                .iter()
                .any(|finding| finding.code == "html-lang-missing"));
        }

    let markup = "<!doctype html><html lang='pl'><head><title>HTTP charset</title></head><body></body></html>";
    let document = Html::parse_document(markup);
    let (findings, _) = validate_crawl_html_with_charset(&document, markup, &base, Some("utf-8"));
    assert!(!findings
        .iter()
        .any(|finding| finding.code == "html-meta-charset-missing"));
}

#[test]
fn html_validation_distinguishes_invalid_and_duplicate_doctypes() {
    let base = url::Url::parse("https://example.com/page").unwrap();
    let invalid_markup = "<!doctype svg><html lang='en'><head><meta charset='utf-8'></head></html>";
    let invalid_document = Html::parse_document(invalid_markup);
    let (invalid_findings, _) =
        validate_crawl_html_with_charset(&invalid_document, invalid_markup, &base, None);
    assert!(invalid_findings
        .iter()
        .any(|finding| finding.code == "html-doctype-invalid"));
    assert!(!invalid_findings
        .iter()
        .any(|finding| finding.code == "html-doctype-missing"));

    let duplicate_markup = "<!doctype html>\n<!doctype html>\n<html lang='en'><head><meta charset='utf-8'></head></html>";
    let duplicate_document = Html::parse_document(duplicate_markup);
    let (duplicate_findings, _) =
        validate_crawl_html_with_charset(&duplicate_document, duplicate_markup, &base, None);
    let duplicate = duplicate_findings
        .iter()
        .find(|finding| finding.code == "html-doctype-duplicate")
        .expect("duplicate doctype finding");
    assert_eq!(duplicate.line, Some(2));
    assert!(duplicate
        .source_excerpt
        .as_deref()
        .is_some_and(|excerpt| excerpt.contains("<!doctype html>")));
    assert!(!duplicate_findings
        .iter()
        .any(|finding| finding.code == "html-doctype-invalid"));
}
