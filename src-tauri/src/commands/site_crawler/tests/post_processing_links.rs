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
