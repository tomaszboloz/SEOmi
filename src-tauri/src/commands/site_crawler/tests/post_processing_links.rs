use super::*;

#[test]
fn post_processing_handles_internal_links_deduplication_and_external_links() {
    let mut page_src = post_processing_page("https://example.com/source");
    page_src.links.push(
        serde_json::from_value(serde_json::json!({
            "target_url": "https://external.org/out",
            "anchor_text": "Ext",
            "is_internal": false
        }))
        .unwrap(),
    );
    page_src.links.push(
        serde_json::from_value(serde_json::json!({
            "target_url": "https://example.com/error",
            "anchor_text": "Err1",
            "is_internal": true
        }))
        .unwrap(),
    );
    page_src.links.push(
        serde_json::from_value(serde_json::json!({
            "target_url": "https://example.com/error",
            "anchor_text": "Err2",
            "is_internal": true
        }))
        .unwrap(),
    );

    let mut page_err = post_processing_page("https://example.com/error");
    page_err.http_status = 500;

    let mut pages = vec![page_src, page_err];
    annotate_page_relations(&mut pages, "http");

    assert!(pages[0].links[0].target_http_status.is_none());
    assert_eq!(pages[0].links[1].target_http_status, Some(500));
    assert_eq!(pages[0].links[2].target_http_status, Some(500));
    assert!(pages[0].issues.iter().any(|i| i
        .message
        .contains("1 internal link target(s) returned an error")));
    assert_eq!(pages[0].issues_count, pages[0].issues.len());
}

#[test]
fn post_processing_maps_hreflangs_and_falls_back_to_url_identity() {
    let mut page_a = post_processing_page("https://example.com/source");
    page_a.final_url = "invalid url".into();
    page_a.pagination_links.push(CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/target".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });
    page_a.hreflangs.push(CrawledHreflang {
        language: "en".into(),
        target_url: "https://example.com/target".into(),
        target_http_status: None,
        target_checked_in_run: false,
        reciprocal_in_run: None,
        target_canonical_alignment: None,
    });

    let mut page_b = post_processing_page("https://example.com/target");
    page_b.pagination_links.push(CrawledPaginationLink {
        relation: "prev".into(),
        target_url: "https://example.com/source".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });

    let mut pages = vec![page_a, page_b];
    annotate_page_relations(&mut pages, "http");

    assert_eq!(pages[0].pagination_links[0].reciprocal_in_run, Some(true));
    assert_eq!(pages[0].hreflangs[0].target_http_status, Some(200));
}
