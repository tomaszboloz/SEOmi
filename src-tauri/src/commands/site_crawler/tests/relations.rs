use super::*;

#[test]
fn relation_annotation_requires_observed_status_in_rendered_mode() {
    for (mode, expected) in [("http", Some(0)), ("browser-rendered", None)] {
        let mut source = post_processing_page("https://example.com/a");
        source.canonical_targets.push(CrawledCanonicalTarget {
            url: "https://example.com/b".into(),
            relation: "other".into(),
            http_status: None,
            checked_in_run: false,
        });
        source.links.push(serde_json::from_value(serde_json::json!({"target_url":"https://example.com/b","anchor_text":"B","is_internal":true})).unwrap());
        let mut target = post_processing_page("https://example.com/b");
        target.http_status = 0;
        let mut pages = vec![source, target];
        annotate_page_relations(&mut pages, mode);
        assert_eq!(pages[0].canonical_targets[0].http_status, expected);
        assert_eq!(pages[0].links[0].target_http_status, expected);
        assert_eq!(
            pages[0]
                .issues
                .iter()
                .filter(|issue| issue.message.contains("Canonical target returned HTTP"))
                .count(),
            usize::from(expected.is_some())
        );
    }
}

#[test]
fn relation_annotation_records_pagination_and_internal_link_errors() {
    let mut page_a = post_processing_page("https://example.com/a");
    page_a.pagination_links.push(CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/b".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });
    page_a.canonical_targets.push(CrawledCanonicalTarget {
        url: "https://example.com/b".into(),
        relation: "canonical".into(),
        http_status: None,
        checked_in_run: false,
    });
    page_a.links.push(
        serde_json::from_value(serde_json::json!({
            "target_url": "https://example.com/b",
            "anchor_text": "Broken Link",
            "is_internal": true
        }))
        .unwrap(),
    );

    let mut page_b = post_processing_page("https://example.com/b");
    page_b.http_status = 404;

    let mut pages = vec![page_a, page_b];
    annotate_page_relations(&mut pages, "http");

    assert!(pages[0].issues.iter().any(|i| i
        .message
        .contains("Pagination next target returned HTTP 404")));
    assert!(pages[0]
        .issues
        .iter()
        .any(|i| i.message.contains("Canonical target returned HTTP 404")));
    assert!(pages[0].issues.iter().any(|i| i
        .message
        .contains("internal link target(s) returned an error")));
    assert!(pages[0]
        .issues
        .iter()
        .any(|i| i.message.contains("no reciprocal prev declaration")));
}
