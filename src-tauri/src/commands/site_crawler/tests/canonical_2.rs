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

#[test]
fn canonical_identity_url_handles_ports_schemes_and_normalization() {
    assert_eq!(canonical_identity_url("ftp://example.com/file"), None);
    assert_eq!(canonical_identity_url("mailto:user@example.com"), None);
    assert_eq!(canonical_identity_url("not a url"), None);

    let http_80 = canonical_identity_url("http://example.com:80/path").unwrap();
    assert_eq!(http_80.port(), None);
    let https_443 = canonical_identity_url("https://example.com:443/path").unwrap();
    assert_eq!(https_443.port(), None);
    let https_custom = canonical_identity_url("https://example.com:8443/path").unwrap();
    assert_eq!(https_custom.port(), Some(8443));

    assert_eq!(
        classify_canonical_relation("https://example.com/", 1, &["ftp://example.com/".into()]),
        "invalid"
    );
    assert_eq!(
        classify_canonical_relation("ftp://example.com/", 1, &["https://example.com/".into()]),
        "invalid"
    );
}
