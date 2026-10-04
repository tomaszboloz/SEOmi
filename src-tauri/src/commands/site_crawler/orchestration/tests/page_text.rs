use super::super::page_content::{extract_page_content, ExtractPageContentInput};
use super::super::page_headings::extract_page_headings;
use super::super::page_title_meta::extract_page_title_and_meta;
use super::*;
use scraper::Html;

#[test]
fn title_and_description_missing_empty_multiple_and_boundary_diagnostics() {
    let selectors = CrawlSelectors::compile();
    for (html, missing_title, missing_description) in [
        ("", true, true),
        ("<title> </title><meta name='description' content=' '>", true, true),
        ("<title>First</title><title>Second</title><meta name='description' content='First'><meta name='description' content='Second'>", false, false),
    ] {
        let mut issues = Vec::new();
        let result = extract_page_title_and_meta(&Html::parse_document(html), true, &selectors.title, &selectors.meta_desc, &mut issues);
        assert_eq!(issues.iter().any(|i| i.message == "Missing <title> tag"), missing_title);
        assert_eq!(issues.iter().any(|i| i.message == "Missing meta description"), missing_description);
        if !missing_title {
            assert_eq!(result.title.as_deref(), Some("First"));
            assert_eq!(result.meta_description.as_deref(), Some("First"));
            assert!(issues.iter().any(|i| i.message == "Multiple <title> tags found (2)"));
            assert!(issues.iter().any(|i| i.message == "Multiple meta descriptions found (2)"));
        }
    }
    for (title_length, description_length, expected_warning) in [
        (30, 70, false),
        (60, 160, false),
        (29, 69, true),
        (61, 161, true),
    ] {
        let html = format!(
            "<title>{}</title><meta name='description' content='{}'>",
            "a".repeat(title_length),
            "b".repeat(description_length)
        );
        let mut issues = Vec::new();
        let result = extract_page_title_and_meta(
            &Html::parse_document(&html),
            true,
            &selectors.title,
            &selectors.meta_desc,
            &mut issues,
        );
        assert_eq!(result.title_length, Some(title_length));
        assert_eq!(result.meta_description_length, Some(description_length));
        assert_eq!(issues.len(), if expected_warning { 2 } else { 0 });
    }
}

#[test]
fn content_extractor_reports_missing_language_and_thin_text_without_inventing_root() {
    let text = "<html lang=' '><title>Title</title><body><p>Short observed text.</p></body></html>";
    let document = Html::parse_document(text);
    let selectors = CrawlSelectors::compile();
    let mut issues = Vec::new();
    let result = extract_page_content(ExtractPageContentInput {
        document: &document,
        body_len: text.len(),
        is_html: true,
        body_truncated: false,
        body_read_failed: false,
        html_selector: &selectors.html,
        title_selector: &selectors.title,
        h1_selector: &selectors.h1,
        headings_selector: &selectors.headings,
        meta_desc_selector: &selectors.meta_desc,
        issues: &mut issues,
    });
    assert!(result.document_language.is_none());
    assert!(!result.has_primary_content_root);
    assert_eq!(result.semantic_content_source, "body-fallback");
    assert_eq!(result.word_count, 3);
    assert_eq!(result.reading_time_minutes, Some(1));
    assert!(issues
        .iter()
        .any(|i| i.message == "Document has no html lang attribute"));
    assert!(issues
        .iter()
        .any(|i| i.message == "Thin text content: 3 words"));
    assert!(issues.iter().any(|i| i.message == "Missing <h1> tag"));
}

#[test]
fn heading_extractor_requires_h1_but_retains_other_observed_levels() {
    let document = Html::parse_document("<h2>Section</h2><h6>Small section</h6>");
    let selectors = CrawlSelectors::compile();
    let mut issues = Vec::new();
    let result = extract_page_headings(
        &document,
        true,
        &selectors.h1,
        &selectors.headings,
        &mut issues,
    );
    assert_eq!(result.h1_count, 0);
    assert_eq!(result.heading_counts, vec![0, 1, 0, 0, 0, 1]);
    assert!(result.duplicate_headings.is_empty());
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].severity, "Critical");
    assert_eq!(issues[0].message, "Missing <h1> tag");
}

#[test]
fn headings_outside_supported_levels_do_not_overflow_count_storage() {
    let document = Html::parse_document("<h0>Zero</h0><h7>Seven</h7><p>Text</p>");
    let selectors = CrawlSelectors::compile();
    let result = extract_page_headings(
        &document,
        true,
        &selectors.h1,
        &scraper::Selector::parse("h0,h7,p").unwrap(),
        &mut Vec::new(),
    );
    assert_eq!(result.heading_counts, vec![0; 6]);
    assert_eq!(result.h1_count, 0);
    assert!(result.duplicate_headings.is_empty());
}
