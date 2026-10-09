use super::*;

#[test]
fn post_processing_leaves_uncrawled_pagination_targets_unverified() {
    let mut page = post_processing_page("https://example.com/source");
    page.pagination_links.push(CrawledPaginationLink {
        relation: "next".into(),
        target_url: "https://example.com/outside-crawl".into(),
        query_parameter_changes: Vec::new(),
        http_status: None,
        checked_in_run: false,
        reciprocal_in_run: None,
    });

    annotate_page_relations(std::slice::from_mut(&mut page), "http");

    let target = &page.pagination_links[0];
    assert_eq!(target.http_status, None);
    assert!(!target.checked_in_run);
    assert_eq!(target.reciprocal_in_run, None);
    assert_eq!(page.issues_count, page.issues.len());
}

#[test]
fn post_processing_ignores_invalid_pagination_identities() {
    let mut malformed_source = post_processing_page("not-a-url");
    malformed_source.final_url = "still-not-a-url".into();
    malformed_source
        .pagination_links
        .push(CrawledPaginationLink {
            relation: "next".into(),
            target_url: "mailto:owner@example.com".into(),
            query_parameter_changes: Vec::new(),
            http_status: None,
            checked_in_run: false,
            reciprocal_in_run: None,
        });
    let mut malformed_target = post_processing_page("mailto:target@example.com");
    malformed_target.http_status = 404;

    let mut pages = vec![malformed_source, malformed_target];
    annotate_page_relations(&mut pages, "http");

    let target = &pages[0].pagination_links[0];
    assert_eq!(target.http_status, None);
    assert!(!target.checked_in_run);
    assert_eq!(target.reciprocal_in_run, None);
    assert!(!pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("no reciprocal")));
}

#[test]
fn post_processing_does_not_use_zero_status_from_rendered_pages() {
    let mut source = post_processing_page("https://example.com/source");
    source.canonical_targets.push(CrawledCanonicalTarget {
        url: "https://example.com/rendered".into(),
        relation: "canonical".into(),
        http_status: None,
        checked_in_run: false,
    });
    let mut rendered = post_processing_page("https://example.com/rendered");
    rendered.http_status = 0;

    let mut pages = vec![source, rendered];
    annotate_page_relations(&mut pages, "browser-rendered");

    assert_eq!(pages[0].canonical_targets[0].http_status, None);
    assert!(!pages[0].canonical_targets[0].checked_in_run);
    assert!(!pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("Canonical target returned HTTP")));
}
