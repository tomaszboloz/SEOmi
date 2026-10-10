use super::super::page_extra_schema_pagination::extract_page_schema_and_pagination;
use super::super::selectors::CrawlSelectors;
use scraper::Html;
use url::Url;

#[test]
fn schema_syntax_warning_and_hreflang_pagination_edges() {
    let html = r#"<!DOCTYPE html>
<html>
<head>
    <link rel="canonical" href="https://example.test/canonical">
    <link rel="alternate" hreflang=" " href="https://example.test/pl">
    <link rel="alternate" hreflang="en">
    <link rel="alternate" hreflang="de" href="https://example.test/de">
    <link rel="alternate" hreflang="es" href="https://example.test/es">
    <link rel="prev" href="https://example.test/page/1">
    <script type="application/ld+json">{ broken json </script>
</head>
<body></body>
</html>"#;
    let document = Html::parse_document(html);
    let base = Url::parse("https://example.test/page/2").unwrap();
    let selectors = CrawlSelectors::compile();
    let mut issues = Vec::new();

    let result = extract_page_schema_and_pagination(
        &document,
        &base,
        true,
        &selectors.canonical,
        &selectors.hreflang,
        &mut issues,
    );

    assert_eq!(result.hreflangs.len(), 2);
    assert_eq!(result.hreflangs[0].language, "de");
    assert_eq!(result.hreflangs[1].language, "es");
    assert_eq!(
        result.pagination_prev.as_deref(),
        Some("https://example.test/page/1")
    );
    assert_eq!(result.schema_syntax_errors, 1);
    assert!(issues
        .iter()
        .any(|i| i.message.contains("invalid JSON-LD block")));
    assert!(result.amp_url.is_none());
}
