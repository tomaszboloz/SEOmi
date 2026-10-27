use super::*;

#[test]
fn post_processing_verifies_canonical_and_pagination_statuses() {
    let mut page_a = post_processing_page("https://example.com/a");
    page_a.canonical_targets.push(CrawledCanonicalTarget {
        url: "https://example.com/b".into(),
        relation: "canonical".into(),
        http_status: None,
        checked_in_run: false,
    });
    page_a.canonical_targets.push(CrawledCanonicalTarget {
        url: "https://example.com/c".into(),
        relation: "canonical".into(),
        http_status: None,
        checked_in_run: false,
    });
    page_a.canonical_targets.push(CrawledCanonicalTarget {
        url: "https://example.com/d".into(),
        relation: "canonical".into(),
        http_status: None,
        checked_in_run: false,
    });
    page_a.pagination_links.push(CrawledPaginationLink {
        relation: "prev".into(),
        target_url: "https://example.com/c".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });
    page_a.pagination_links.push(CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/b".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });

    let mut page_b = post_processing_page("https://example.com/b");
    page_b.http_status = 200;
    let mut page_c = post_processing_page("https://example.com/c");
    page_c.http_status = 500;

    let mut pages = vec![page_a, page_b, page_c];
    annotate_page_relations(&mut pages, "http");

    assert_eq!(pages[0].canonical_targets[0].http_status, Some(200));
    assert!(pages[0].canonical_targets[0].checked_in_run);
    assert_eq!(pages[0].canonical_targets[1].http_status, Some(500));
    assert!(pages[0].canonical_targets[1].checked_in_run);
    assert_eq!(pages[0].canonical_targets[2].http_status, None);
    assert!(!pages[0].canonical_targets[2].checked_in_run);

    assert_eq!(pages[0].pagination_links[0].http_status, Some(500));
    assert_eq!(pages[0].pagination_links[1].http_status, Some(200));

    assert!(pages[0]
        .issues
        .iter()
        .any(|i| i.message.contains("Canonical target returned HTTP 500")));
    assert!(!pages[0]
        .issues
        .iter()
        .any(|i| i.message.contains("Canonical target returned HTTP 200")));
    assert!(pages[0].issues.iter().any(|i| i
        .message
        .contains("Pagination prev target returned HTTP 500")));
}

#[test]
fn post_processing_evaluates_reciprocal_pagination_matches_and_mismatches() {
    let mut page_1 = post_processing_page("https://example.com/p1");
    page_1.pagination_links.push(CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/p2".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });

    let mut page_2 = post_processing_page("https://example.com/p2");
    page_2.pagination_links.push(CrawledPaginationLink {
        relation: "prev".into(),
        target_url: "https://example.com/p1".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });
    page_2.pagination_links.push(CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/p3".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });

    let page_3 = post_processing_page("https://example.com/p3");

    page_1.pagination_links.push(CrawledPaginationLink {
        relation: "first".into(),
        target_url: "https://example.com/p1".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });

    let mut pages = vec![page_1, page_2, page_3];
    annotate_page_relations(&mut pages, "http");

    assert_eq!(pages[0].pagination_links[0].reciprocal_in_run, Some(true));
    assert_eq!(pages[0].pagination_links[1].reciprocal_in_run, None);
    assert_eq!(pages[1].pagination_links[0].reciprocal_in_run, Some(true));
    assert_eq!(pages[1].pagination_links[1].reciprocal_in_run, Some(false));
    assert!(pages[1]
        .issues
        .iter()
        .any(|i| i.message.contains("no reciprocal prev declaration")));
}

#[path = "post_processing_links.rs"]
mod links;
