use super::*;

#[test]
fn percent_canonicalization_preserves_malformed_and_reserved_escapes() {
    assert_eq!(canonicalize_unreserved_percent_encoding("abc"), "abc");
    assert_eq!(canonicalize_unreserved_percent_encoding("%"), "%");
    assert_eq!(canonicalize_unreserved_percent_encoding("%A"), "%A");
    assert_eq!(canonicalize_unreserved_percent_encoding("%GG"), "%GG");
    assert_eq!(canonicalize_unreserved_percent_encoding("%A?"), "%A?");
    assert_eq!(
        canonicalize_unreserved_percent_encoding("%7e%2f%20"),
        "~%2F%20"
    );
}

#[test]
fn query_parameter_names_are_trimmed_lowercased_and_deduplicated() {
    let names = normalized_query_parameter_names(&[
        " UTM_Source ".into(),
        "page".into(),
        "PAGE".into(),
        "  ".into(),
        "Lang".into(),
    ]);
    assert_eq!(names.len(), 3);
    assert!(names.contains("utm_source"));
    assert!(names.contains("page"));
    assert!(names.contains("lang"));
}

#[test]
fn normalization_handles_non_default_scheme_root_slash_and_empty_retained_query() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.strip_tracking_parameters = true;
    config.trim_trailing_slash = true;
    let ftp = normalize_crawl_url(url::Url::parse("ftp://Example.com:21/").unwrap(), &config);
    assert_eq!(ftp.as_str(), "ftp://example.com/");
    let clean = normalize_crawl_url(
        url::Url::parse("https://example.com/?utm_source=x#fragment").unwrap(),
        &config,
    );
    assert_eq!(clean.as_str(), "https://example.com/");
}

#[test]
fn normalization_keeps_queries_when_no_filter_is_configured_and_filters_denied_values() {
    let mut untouched = crawl_config_for_test();
    untouched.keep_query_strings = true;
    let source = url::Url::parse("https://example.com/a?x=1&y=2").unwrap();
    assert_eq!(
        normalize_crawl_url(source, &untouched).query(),
        Some("x=1&y=2")
    );

    let mut config = untouched.clone();
    config.denied_query_parameters = vec![" X ".into()];
    let filtered = normalize_crawl_url(
        url::Url::parse("https://example.com/a?x=1&y=2").unwrap(),
        &config,
    );
    assert_eq!(filtered.query(), Some("y=2"));
}
