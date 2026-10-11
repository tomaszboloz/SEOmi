use super::super::page_content::{extract_page_content, ExtractPageContentInput};
use super::page_type_guidance::thin_issue;
use super::*;
use scraper::Html;

#[test]
fn aria_hidden_text_does_not_hide_the_iframe_only_wrapper_unless_truthy() {
    for (value, expected) in [("true", true), ("YES", true), ("false", false)] {
        let html = format!(
            "<html><body><div aria-hidden='{value}'>Some words here</div>\
             <iframe src='https://video.example/embed/1'></iframe></body></html>"
        );
        let issue = thin_issue(&html, "https://example.test/embed", "http").unwrap();
        assert_eq!(issue.contains("iframe-only wrapper"), expected, "{value}");
    }
}

#[test]
fn framework_marker_attributes_identify_an_application_shell() {
    for attribute in [
        "data-reactroot",
        "data-v-app",
        "ng-version=\"17\"",
        "ng-app",
    ] {
        let html = format!(
            "<html><body><div {attribute}></div><script src='/assets/app.js'></script></body></html>"
        );
        let issue = thin_issue(&html, "https://example.test/app", "http").unwrap();
        assert!(issue.starts_with("Little or no text"), "{attribute}");
    }
}

#[test]
fn incomplete_or_non_html_bodies_do_not_receive_thin_content_findings() {
    let document = Html::parse_document("<html><body><p>Short.</p></body></html>");
    let selectors = CrawlSelectors::compile();
    for (is_html, truncated, failed, expect_thin) in [
        (true, false, false, true),
        (false, false, false, false),
        (true, true, false, false),
        (true, false, true, false),
    ] {
        let mut issues = Vec::new();
        extract_page_content(ExtractPageContentInput {
            document: &document,
            page_url: "https://example.test/short",
            crawl_mode: "http",
            body_len: 40,
            status: 200,
            is_html,
            body_truncated: truncated,
            body_read_failed: failed,
            html_selector: &selectors.html,
            title_selector: &selectors.title,
            h1_selector: &selectors.h1,
            headings_selector: &selectors.headings,
            meta_desc_selector: &selectors.meta_desc,
            issues: &mut issues,
        });
        let has_thin = issues.iter().any(|i| i.message.starts_with("Thin text"));
        assert_eq!(has_thin, expect_thin, "{is_html} {truncated} {failed}");
    }
}
