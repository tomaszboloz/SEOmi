use super::*;

#[test]
fn canonical_target_status_is_set_only_when_target_is_in_the_same_run() {
    let statuses = HashMap::from([("https://example.com/canonical".into(), 404)]);
    let mut crawled = CrawledCanonicalTarget {
        url: "https://example.com/canonical".into(),
        relation: "same-host-other-url".into(),
        http_status: None,
        checked_in_run: false,
    };
    let mut not_crawled = CrawledCanonicalTarget {
        url: "https://example.com/outside-run".into(),
        relation: "same-host-other-url".into(),
        http_status: None,
        checked_in_run: false,
    };

    assert_eq!(verify_canonical_target(&mut crawled, &statuses), Some(404));
    assert_eq!(crawled.http_status, Some(404));
    assert!(crawled.checked_in_run);
    assert_eq!(verify_canonical_target(&mut not_crawled, &statuses), None);
    assert_eq!(not_crawled.http_status, None);
    assert!(!not_crawled.checked_in_run);
}
