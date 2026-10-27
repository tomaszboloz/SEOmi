use super::*;

#[test]
fn test_boundary_url_normalization_edges() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.strip_tracking_parameters = true;
    config.trim_trailing_slash = true;

    let url_str = "https://[::ffff:192.0.2.1]:8443/path/to/resource//?utm_campaign=test&b=2&a=1#";
    let parsed = url::Url::parse(url_str).unwrap();
    let norm = normalize_crawl_url(parsed, &config);
    assert_eq!(norm.port(), Some(8443));
    assert!(norm.as_str().contains("[::ffff:192.0.2.1]"));
    assert!(!norm.as_str().contains("utm_campaign"));
    assert!(!norm.as_str().ends_with("//"));

    let malformed = "https://example.com/foo%GGbar?q=%Z1baz";
    let parsed_malformed = url::Url::parse(malformed).unwrap();
    let norm_mal = normalize_crawl_url(parsed_malformed, &config);
    assert!(norm_mal.as_str().contains("example.com"));
}
