use super::*;

#[test]
fn pagination_target_status_is_set_only_when_target_is_in_the_same_run() {
    let statuses = HashMap::from([("https://example.com/page/2".into(), 200)]);
    let mut crawled = CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/page/2".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    };
    let mut not_crawled = CrawledPaginationLink {
        relation: "prev".into(),
        target_url: "https://example.com/page/0".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    };

    assert_eq!(verify_pagination_target(&mut crawled, &statuses), Some(200));
    assert_eq!(crawled.http_status, Some(200));
    assert!(crawled.checked_in_run);
    assert_eq!(verify_pagination_target(&mut not_crawled, &statuses), None);
    assert_eq!(not_crawled.http_status, None);
    assert!(!not_crawled.checked_in_run);
}

#[test]
fn pagination_annotation_distinguishes_reciprocal_missing_and_unobserved_targets() {
    let link = |relation: &str, url: &str| CrawledPaginationLink {
        relation: relation.into(),
        target_url: url.into(),
        query_parameter_changes: vec![],
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    };
    for reciprocal in [false, true] {
        let mut source = post_processing_page("https://example.com/a");
        source
            .pagination_links
            .push(link("next", "https://example.com/b"));
        source
            .pagination_links
            .push(link("prev", "https://example.com/not-crawled"));
        let mut target = post_processing_page("https://example.com/b");
        target.http_status = 404;
        if reciprocal {
            target
                .pagination_links
                .push(link("prev", "https://example.com/a"));
        }
        let mut pages = vec![source, target];
        annotate_page_relations(&mut pages, "http");
        assert_eq!(pages[0].pagination_links[0].http_status, Some(404));
        assert_eq!(
            pages[0].pagination_links[0].reciprocal_in_run,
            Some(reciprocal)
        );
        assert_eq!(pages[0].pagination_links[1].reciprocal_in_run, None);
        assert!(pages[0].issues.iter().any(|issue| issue
            .message
            .contains("Pagination next target returned HTTP 404")));
        assert_eq!(
            pages[0]
                .issues
                .iter()
                .filter(|issue| issue.message.contains("has no reciprocal"))
                .count(),
            usize::from(!reciprocal)
        );
        assert_eq!(pages[0].issues_count, pages[0].issues.len());
    }
}
