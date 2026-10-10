use super::page_fixture::*;
use super::*;

#[test]
fn requested_rendered_mode_does_not_label_uncaptured_http_content_as_rendered() {
    let page_data = data(HTML);
    let evidence = signals(
        &page_data,
        &setup(default_crawl_config(None)),
        &mut state(),
        &mut Vec::new(),
    );
    let page = summary(&page_data, evidence, Vec::new(), "browser-rendered");
    assert_eq!(page.semantic_content_provenance, "http");
    assert!(!page.semantic_terms.is_empty());
}

#[test]
fn failed_render_with_incomplete_http_body_keeps_unavailable_provenance() {
    let mut page_data = data(HTML);
    page_data.render_fallback = Some("capture failed".into());
    page_data.body_read_failed = true;
    let evidence = signals(
        &page_data,
        &setup(default_crawl_config(None)),
        &mut state(),
        &mut Vec::new(),
    );
    let page = summary(&page_data, evidence, Vec::new(), "browser-rendered");
    assert_eq!(page.semantic_content_provenance, "unavailable");
    assert!(page.semantic_terms.is_empty());
    assert!(page.semantic_content_partial);
}
