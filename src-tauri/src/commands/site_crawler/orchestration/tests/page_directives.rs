use super::super::page_metadata_directives::extract_page_directives;
use super::page_fixture::*;
use super::*;
use scraper::Html;
use url::Url;

#[test]
fn unusable_html_cannot_supply_robots_or_redirects_but_headers_remain_observed() {
    let document = Html::parse_document(
        r#"<html><head>
        <meta name="robots" content="noindex,nofollow">
        <meta http-equiv="refresh" content="0;url=/html-target">
        <script>location.href='/script-target';</script></head></html>"#,
    );
    for kind in ["truncated", "read-failed", "non-html"] {
        let mut page_data = data("");
        page_data.body_truncated = kind == "truncated";
        page_data.body_read_failed = kind == "read-failed";
        page_data.declared_html = kind != "non-html";
        page_data.x_robots_tag = Some("noindex, nofollow".into());
        page_data.http_refresh = Some("2;url=/header-target".into());
        let selectors = CrawlSelectors::compile();
        let mut issues = Vec::new();
        let directives = extract_page_directives(
            &document,
            &Url::parse(FINAL_URL).unwrap(),
            &page_data,
            &selectors.robots,
            &selectors.meta_refresh,
            &mut issues,
        );
        assert!(directives.meta_robots.is_none());
        assert!(!directives.meta_noindex && !directives.meta_nofollow);
        assert!(directives.header_noindex && directives.header_nofollow);
        assert_eq!(directives.client_redirects.len(), 1);
        let redirect = &directives.client_redirects[0];
        assert_eq!(redirect.source, "http-refresh");
        assert_eq!(redirect.delay_seconds, Some(2.0));
        assert_eq!(
            redirect.target_url.as_deref(),
            Some("https://example.test/header-target")
        );
        assert!(!issues
            .iter()
            .any(|issue| issue.message.contains("meta robots")));
        assert!(issues
            .iter()
            .any(|issue| issue.message.contains("X-Robots-Tag")));
    }
}

#[test]
fn usable_html_preserves_both_document_and_header_directives() {
    let document = Html::parse_document(
        r#"<meta name="robots" content="noindex,nofollow">
        <meta http-equiv="refresh" content="0;url=/html-target">"#,
    );
    let mut page_data = data("");
    page_data.http_refresh = Some("2;url=/header-target".into());
    let selectors = CrawlSelectors::compile();
    let directives = extract_page_directives(
        &document,
        &Url::parse(FINAL_URL).unwrap(),
        &page_data,
        &selectors.robots,
        &selectors.meta_refresh,
        &mut Vec::new(),
    );
    assert_eq!(directives.meta_robots.as_deref(), Some("noindex,nofollow"));
    assert!(directives.meta_noindex && directives.meta_nofollow);
    assert!(!directives.header_noindex && !directives.header_nofollow);
    assert_eq!(directives.client_redirects.len(), 2);
    assert_eq!(directives.client_redirects[0].source, "meta-refresh");
    assert_eq!(directives.client_redirects[1].source, "http-refresh");
}
