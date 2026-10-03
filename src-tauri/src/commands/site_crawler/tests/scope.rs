use super::*;

#[test]
fn scope_respects_subdomain_setting() {
    let child = url::Url::parse("https://docs.example.com/guide").unwrap();
    assert!(!matches_scope(&child, "example.com", false, None, &[]));
    assert!(matches_scope(&child, "example.com", true, None, &[]));
}

#[test]
fn scope_limits_crawling_to_the_selected_directory() {
    let kept = url::Url::parse("https://example.com/docs/guide").unwrap();
    let excluded = url::Url::parse("https://example.com/blog/post").unwrap();
    let near_match = url::Url::parse("https://example.com/docs-old").unwrap();
    assert!(matches_scope(
        &kept,
        "example.com",
        false,
        Some("/docs"),
        &[]
    ));
    assert!(!matches_scope(
        &excluded,
        "example.com",
        false,
        Some("/docs"),
        &[]
    ));
    assert!(!matches_scope(
        &near_match,
        "example.com",
        false,
        Some("/docs"),
        &[]
    ));
}

#[test]
fn scope_accepts_only_explicitly_allowlisted_hosts() {
    let external = url::Url::parse("https://docs.partner.example/guide").unwrap();
    let allowlist = vec!["docs.partner.example".to_string()];
    assert!(matches_scope(
        &external,
        "example.com",
        false,
        Some("/private"),
        &allowlist
    ));
    assert!(!matches_scope(
        &url::Url::parse("https://unknown.partner.example/guide").unwrap(),
        "example.com",
        false,
        None,
        &allowlist
    ));
}

#[test]
fn allowlisted_hosts_are_normalized_and_invalid_entries_are_rejected() {
    let hosts = normalize_allowed_hosts(&[
        " HTTPS://Docs.Example.com/ ".to_string(),
        "docs.example.com".to_string(),
    ])
    .unwrap();
    assert_eq!(hosts, vec!["docs.example.com"]);
    assert!(normalize_allowed_hosts(&["docs.example.com/path".to_string()]).is_err());
}

#[test]
fn filters_require_include_and_reject_exclude() {
    let include = vec![Regex::new("/docs/").unwrap()];
    let exclude = vec![Regex::new("private").unwrap()];
    assert!(matches_filters(
        "https://example.com/docs/guide",
        &include,
        &exclude
    ));
    assert!(!matches_filters(
        "https://example.com/blog/post",
        &include,
        &exclude
    ));
    assert!(!matches_filters(
        "https://example.com/docs/private",
        &include,
        &exclude
    ));
}

#[test]
fn url_normalization_applies_explicit_path_and_query_rules_in_a_stable_order() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.trim_trailing_slash = true;
    config.lowercase_path = true;
    config.strip_tracking_parameters = true;
    config.allowed_query_parameters = vec!["page".into(), "lang".into(), "gclid".into()];
    config.denied_query_parameters = vec!["lang".into()];

    let source = url::Url::parse(
        "https://example.com/Docs/Guide/?utm_source=newsletter&page=2&lang=pl&gclid=test#section",
    )
    .unwrap();
    let normalized = normalize_crawl_url(source, &config);

    assert_eq!(normalized.as_str(), "https://example.com/docs/guide?page=2");
}

#[test]
fn url_normalization_keeps_the_existing_default_of_dropping_all_query_parameters() {
    let source = url::Url::parse("https://example.com/docs/?page=2#section").unwrap();
    let normalized = normalize_crawl_url(source, &crawl_config_for_test());

    assert_eq!(normalized.as_str(), "https://example.com/docs/");
}

#[test]
fn url_normalization_collapses_default_ports_and_host_trailing_dots() {
    let https = url::Url::parse("HTTPS://Example.COM.:443/guide").unwrap();
    let http = url::Url::parse("http://Example.COM:80/guide").unwrap();

    assert_eq!(
        normalize_crawl_url(https, &crawl_config_for_test()).as_str(),
        "https://example.com/guide"
    );
    assert_eq!(
        normalize_crawl_url(http, &crawl_config_for_test()).as_str(),
        "http://example.com/guide"
    );
}
