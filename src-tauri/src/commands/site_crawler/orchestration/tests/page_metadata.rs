use super::super::page_metadata::{extract_page_metadata, ExtractPageMetadataInput};
use super::super::page_status_issues::check_page_status_issues;
use super::page_fixture::*;
use super::*;
use scraper::Html;
use url::Url;

#[test]
fn metadata_extractor_reports_canonical_noindex_conflict_only_from_usable_html() {
    let text = "<link rel='canonical' href='/elsewhere'><meta name='robots' content='noindex'>";
    let document = Html::parse_document(text);
    let selectors = CrawlSelectors::compile();
    let base = Url::parse(FINAL_URL).unwrap();
    for truncated in [false, true] {
        let mut page_data = data(text);
        page_data.body_truncated = truncated;
        let mut issues = Vec::new();
        let result = extract_page_metadata(ExtractPageMetadataInput {
            page_data: &page_data,
            document: &document,
            final_base: &base,
            final_url: FINAL_URL,
            current_url: FINAL_URL,
            redirect_chain_len: 0,
            redirect_stopped_reason: None,
            pagination_declaration_count: 0,
            pagination_invalid_declaration_count: 0,
            config: &default_crawl_config(None),
            robots_selector: &selectors.robots,
            meta_refresh_selector: &selectors.meta_refresh,
            issues: &mut issues,
        });
        assert_eq!(result.canonical_robots_conflict, !truncated);
        assert_eq!(
            result.meta_robots.as_deref(),
            (!truncated).then_some("noindex")
        );
        assert_eq!(
            issues
                .iter()
                .any(|i| i.message.starts_with("Canonical and noindex")),
            !truncated
        );
        if !truncated {
            assert_eq!(result.indexability_status, "Excluded by robots directive");
            assert_eq!(
                result.canonical.as_deref(),
                Some("https://example.test/elsewhere")
            );
        } else {
            assert!(result.canonical.is_none());
        }
    }
}

#[test]
fn status_diagnostics_report_bounded_browser_errors_and_unavailable_response_checks() {
    let mut page_data = data("");
    page_data.status = 0;
    page_data.response_headers_available = false;
    page_data.declared_html = false;
    page_data.body_truncated = true;
    page_data.body_read_failed = true;
    page_data.rendered_diagnostics = Some((
        (0..12).map(|i| format!("resource-{i}")).collect(),
        (0..12).map(|i| format!("console-{i}")).collect(),
    ));
    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    let mut issues = Vec::new();
    check_page_status_issues(
        &page_data,
        FINAL_URL,
        CURRENT_URL,
        2,
        Some(&"stopped".into()),
        &config,
        &mut issues,
    );
    assert_eq!(issues.len(), 25);
    assert_eq!(
        issues
            .iter()
            .filter(|i| i.message.contains("resource: resource-"))
            .count(),
        10
    );
    assert_eq!(
        issues
            .iter()
            .filter(|i| i.message.contains("console error: console-"))
            .count(),
        10
    );
    assert!(!issues
        .iter()
        .any(|i| i.message.contains("resource-10") || i.message.contains("console-10")));
    assert!(!issues.iter().any(|i| {
        i.message
            .contains("Response body exceeded the configured limit")
    }));
    assert!(!issues.iter().any(|i| {
        i.message
            .contains("Response body could not be read completely")
    }));
    for expected in [
        "Safely followed 2 redirect(s)",
        "stopped",
        "Browser did not expose the HTTP status for this rendered response",
        "Non-HTML resource: HTML SEO checks were skipped",
    ] {
        assert!(issues.iter().any(|i| i.message == expected));
    }
    page_data.status = 503;
    page_data.rendered_diagnostics = None;
    issues.clear();
    check_page_status_issues(
        &page_data,
        FINAL_URL,
        FINAL_URL,
        0,
        None,
        &default_crawl_config(None),
        &mut issues,
    );
    assert!(issues
        .iter()
        .any(|i| i.severity == "Critical" && i.message == "HTTP error status 503"));
}

#[test]
fn same_url_rendered_navigation_with_known_status_does_not_invent_missing_status_or_redirect() {
    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    let mut issues = Vec::new();
    check_page_status_issues(
        &data(""),
        FINAL_URL,
        FINAL_URL,
        0,
        None,
        &config,
        &mut issues,
    );
    assert!(issues.is_empty());
}
