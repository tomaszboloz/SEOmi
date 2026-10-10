use super::*;

#[test]
fn normalization_preserves_duplicate_values_order_and_reserved_path_delimiters() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.strip_tracking_parameters = true;
    let source = url::Url::parse(
        "https://Example.com:8443/a%2fb/%7Euser?tag=one&%75tm_source=x&tag=two&empty=&q=a%2Bb#x",
    )
    .unwrap();
    let normalized = normalize_crawl_url(source, &config);
    assert_eq!(
        normalized.as_str(),
        "https://example.com:8443/a%2Fb/~user?tag=one&tag=two&empty=&q=a%2Bb",
    );
    assert_eq!(
        normalized.query_pairs().collect::<Vec<_>>(),
        vec![
            ("tag".into(), "one".into()),
            ("tag".into(), "two".into()),
            ("empty".into(), "".into()),
            ("q".into(), "a+b".into()),
        ],
    );
}

#[test]
fn normalized_query_matching_preserves_case_and_denial_overrides_allowance() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.allowed_query_parameters = vec![" PAGE ".into(), "token".into()];
    config.denied_query_parameters = vec![" TOKEN ".into()];
    let normalized = normalize_crawl_url(
        url::Url::parse("https://example.com/?Page=One&pAgE=Two&TOKEN=secret&other=x").unwrap(),
        &config,
    );
    assert_eq!(normalized.query(), Some("Page=One&pAgE=Two"));
}

#[test]
fn dropping_queries_overrides_parameter_allowances_and_keeps_path_options_opt_in() {
    let mut config = crawl_config_for_test();
    config.allowed_query_parameters = vec!["page".into()];
    let source = url::Url::parse("https://example.com/Docs///?page=2#heading").unwrap();
    assert_eq!(
        normalize_crawl_url(source.clone(), &config).as_str(),
        "https://example.com/Docs///",
    );
    config.lowercase_path = true;
    config.trim_trailing_slash = true;
    assert_eq!(
        normalize_crawl_url(source, &config).as_str(),
        "https://example.com/docs",
    );
}

#[test]
fn tracking_filter_removes_exact_tracking_names_without_removing_similar_business_names() {
    let mut config = crawl_config_for_test();
    config.keep_query_strings = true;
    config.strip_tracking_parameters = true;
    let names = "gclid=1&dclid=1&fbclid=1&msclkid=1&mc_cid=1&mc_eid=1&_ga=1&_gl=1&UTM_X=1";
    let source = format!("https://example.com/?{names}&gclid_extra=2&my_utm_source=3&ga=4");
    assert_eq!(
        normalize_crawl_url(url::Url::parse(&source).unwrap(), &config).query(),
        Some("gclid_extra=2&my_utm_source=3&ga=4"),
    );
}
