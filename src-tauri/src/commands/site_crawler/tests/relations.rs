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
