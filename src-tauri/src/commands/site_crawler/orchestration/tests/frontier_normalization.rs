use super::*;

#[test]
fn seed_variants_share_one_normalized_queue_entry_and_one_provenance_record() {
    let mut config = default_crawl_config(None);
    config.list_mode = true;
    config.lowercase_path = true;
    config.trim_trailing_slash = true;
    config.strip_tracking_parameters = true;
    config.keep_query_strings = true;
    config.include_patterns = vec!["/docs/guide$".into()];
    config.seed_urls = vec![
        "https://EXAMPLE.test:443/Docs/Guide/?utm_source=one#first".into(),
        "https://example.test/docs/guide#second".into(),
        "https://example.test/docs/guide/?fbclid=two".into(),
    ];
    let setup = setup(config);
    let mut sources = Default::default();
    let mut truncated = false;
    let frontier = init_frontier(&setup, &[], &mut sources, &mut truncated);
    let target = "https://example.test/docs/guide";
    assert_eq!(
        frontier.queue.into_iter().collect::<Vec<_>>(),
        vec![(target.into(), 0)]
    );
    assert_eq!(frontier.visited.len(), 1);
    assert!(frontier.rejected_urls.is_empty());
    assert_eq!(sources.len(), 1);
    assert_eq!(sources[target].len(), 1);
    assert_eq!(sources[target][0].kind, "seed");
    assert!(!truncated);
}

#[test]
fn normalized_completed_seed_is_skipped_while_other_seed_rejections_stay_explainable() {
    let mut config = default_crawl_config(None);
    config.list_mode = true;
    config.scope_path = Some("/docs".into());
    config.trim_trailing_slash = true;
    config.exclude_patterns = vec!["private$".into()];
    config.resume_completed_urls = vec!["https://example.test/docs/done/?x=1#fragment".into()];
    config.seed_urls = vec![
        "https://example.test/docs/done#other".into(),
        "https://example.test/docs/next/?utm_source=x".into(),
        "https://example.test/docs/private/?x=1".into(),
        "https://example.test/docs-old/".into(),
    ];
    let setup = setup(config);
    let mut sources = Default::default();
    let mut truncated = false;
    let frontier = init_frontier(&setup, &[], &mut sources, &mut truncated);
    assert_eq!(
        frontier.queue.into_iter().collect::<Vec<_>>(),
        vec![("https://example.test/docs/next".into(), 0)],
    );
    assert!(frontier.visited.contains("https://example.test/docs/done"));
    assert!(!sources.contains_key("https://example.test/docs/done"));
    assert_eq!(frontier.rejected_urls.len(), 2);
    assert_eq!(
        frontier.rejected_urls[0].url,
        "https://example.test/docs/private"
    );
    assert_eq!(frontier.rejected_urls[0].reason, "Excluded by crawl filter");
    assert_eq!(
        frontier.rejected_urls[1].reason,
        "Outside configured crawl scope"
    );
}
use super::super::frontier::init_frontier;
