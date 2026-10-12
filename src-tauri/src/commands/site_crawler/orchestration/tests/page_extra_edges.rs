use super::super::page_extra_schema_pagination::extract_page_schema_and_pagination;
use super::super::page_extra_social::extract_page_social_and_frames;
use super::super::selectors::CrawlSelectors;
use super::*;
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

#[test]
fn social_meta_image_candidates_added_to_resource_candidates() {
    let html = r#"<!DOCTYPE html>
<html>
<head>
    <meta property="og:image" content="https://example.test/social.png">
    <link rel="icon" href="/favicon.ico">
</head>
<body></body>
</html>"#;
    let document = Html::parse_document(html);
    let base = Url::parse("https://example.test/page").unwrap();
    let mut config = default_crawl_config(None);
    config.crawl_images = true;
    let setup = setup(config);
    let mut state = state();

    let outcome = extract_page_social_and_frames(
        &document,
        &base,
        "https://example.test/page",
        true,
        &setup,
        &mut state,
    );

    assert_eq!(outcome.favicons.len(), 1);
    assert_eq!(outcome.social_meta_tags.len(), 1);
    assert!(state
        .resource_candidates
        .contains_key("https://example.test/social.png"));
    assert!(state
        .resource_candidates
        .contains_key("https://example.test/favicon.ico"));
}

#[test]
fn extract_page_social_and_frames_non_html_returns_empty() {
    let document = Html::parse_document("not html content");
    let base = Url::parse("https://example.test/page").unwrap();
    let setup = setup(default_crawl_config(None));
    let mut state = state();

    let outcome = extract_page_social_and_frames(
        &document,
        &base,
        "https://example.test/page",
        false,
        &setup,
        &mut state,
    );

    assert!(outcome.favicons.is_empty());
    assert!(outcome.social_meta_tags.is_empty());
    assert!(outcome.frames.is_empty());
    assert!(!outcome.frames_truncated);
    assert!(state.resource_candidates.is_empty());
}

#[test]
fn hreflang_entries_without_a_usable_href_are_skipped() {
    let document = Html::parse_document(
        r#"<head><link hreflang="en"><link hreflang="de" href="http://[bad"></head>"#,
    );
    let base = Url::parse("https://example.test/").unwrap();
    let selectors = CrawlSelectors::compile();
    let loose = scraper::Selector::parse("link").unwrap();
    let result = extract_page_schema_and_pagination(
        &document,
        &base,
        true,
        &selectors.canonical,
        &loose,
        &mut Vec::new(),
    );
    assert!(result.hreflangs.is_empty());
}
