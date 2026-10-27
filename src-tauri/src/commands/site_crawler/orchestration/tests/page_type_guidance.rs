use super::super::page_content::{extract_page_content, ExtractPageContentInput};
use super::*;
use scraper::Html;

pub(super) fn thin_issue(html: &str, page_url: &str, crawl_mode: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let selectors = CrawlSelectors::compile();
    let mut issues = Vec::new();
    extract_page_content(ExtractPageContentInput {
        document: &document,
        page_url,
        crawl_mode,
        body_len: html.len(),
        status: 200,
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
    issues.into_iter().find_map(|issue| {
        let guidance = issue.severity == "Info"
            && [
                "Thin text content",
                "Listing or archive page",
                "Little or no text",
                "The HTML is an iframe-only wrapper",
            ]
            .iter()
            .any(|prefix| issue.message.starts_with(prefix));
        guidance.then_some(issue.message)
    })
}

#[test]
fn ordinary_short_article_keeps_thin_text_finding() {
    let issue = thin_issue(
        "<html><body><article><p>Short article text.</p></article></body></html>",
        "https://example.test/article",
        "http",
    );
    assert_eq!(issue.as_deref(), Some("Thin text content: 3 words"));
}

#[test]
fn pagination_path_and_rel_links_are_listing_evidence() {
    for (html, url) in [
        (
            "<html><body><a href='/one'>One</a><link rel='next' href='/two'></body></html>",
            "https://example.test/archive",
        ),
        (
            "<html><body><a href='/one'>One</a></body></html>",
            "https://example.test/archive/page/2",
        ),
    ] {
        let issue = thin_issue(html, url, "http").unwrap();
        assert!(issue.starts_with("Listing or archive page"));
        assert!(!issue.starts_with("Thin text content"));
    }
}

#[test]
fn collection_and_blog_json_ld_types_are_listing_evidence() {
    for kind in ["CollectionPage", "Blog"] {
        let html = format!("<html><body><script type='application/ld+json'>{{\"@type\":\"{kind}\"}}</script><p>Index</p></body></html>");
        assert!(thin_issue(&html, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Listing or archive page"));
    }
}

#[test]
fn collection_microdata_types_are_listing_evidence() {
    for marker in ["https://schema.org/CollectionPage", "Blog"] {
        let html = format!("<html><body><div itemtype='{marker}'><p>Index</p></div></body></html>");
        assert!(thin_issue(&html, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Listing or archive page"));
    }
}

#[test]
fn mostly_internal_page_links_need_real_navigation_evidence() {
    let html = "<html><body><a href='/one'>One</a><a href='/two'>Two</a><a href='/three'>Three</a><a href='/four'>Four</a></body></html>";
    assert!(thin_issue(html, "https://example.test/archive", "http")
        .unwrap()
        .starts_with("Listing or archive page"));
}

#[test]
fn site_menu_does_not_turn_an_article_into_a_listing() {
    let html = "<html><body><nav><a href='/one'>One</a><a href='/two'>Two</a><a href='/three'>Three</a><a href='/four'>Four</a></nav><article><p>Short article text.</p></article></body></html>";
    assert_eq!(
        thin_issue(html, "https://example.test/article", "http").as_deref(),
        Some("Thin text content: 3 words")
    );
}

#[test]
fn application_shell_in_http_mode_recommends_rendering() {
    let html =
        "<html><body><div id='root'></div><script src='/assets/app.123.js'></script></body></html>";
    let issue = thin_issue(html, "https://example.test/app", "http").unwrap();
    assert!(issue.contains("application root and JavaScript bundle"));
    assert!(issue.contains("browser-rendered mode"));
}

#[test]
fn application_shell_in_rendered_mode_keeps_thin_text_signal() {
    let html =
        "<html><body><div id='root'></div><script src='/assets/app.123.js'></script></body></html>";
    assert_eq!(
        thin_issue(html, "https://example.test/app", "browser-rendered").as_deref(),
        Some("Thin text content: 0 words")
    );
}

#[test]
fn iframe_only_wrapper_has_separate_guidance() {
    let html = "<html><body><div hidden>Hidden wrapper words</div><div style='display:none'>Hidden style words</div><template>Template words</template><iframe src='https://video.example/embed/1'></iframe><script src='/assets/app.js'></script></body></html>";
    let issue = thin_issue(html, "https://example.test/embed", "http").unwrap();
    assert!(issue.contains("iframe-only wrapper"));
    assert!(!issue.starts_with("Thin text content"));
}

#[test]
fn external_or_asset_links_do_not_trigger_listing_detection() {
    let html = "<html><body><a href='https://outside.example/one'>One</a><a href='/app.js'>Two</a><a href='/styles.css'>Three</a><a href='#section'>Four</a></body></html>";
    assert_eq!(
        thin_issue(html, "https://example.test/article", "http").as_deref(),
        Some("Thin text content: 4 words")
    );
}

#[test]
fn iframe_with_visible_wrapper_text_remains_an_ordinary_short_page() {
    let html = "<html><body><h1>Embedded video</h1><iframe src='/video'></iframe></body></html>";
    assert_eq!(
        thin_issue(html, "https://example.test/video", "http").as_deref(),
        Some("Thin text content: 2 words")
    );
}
