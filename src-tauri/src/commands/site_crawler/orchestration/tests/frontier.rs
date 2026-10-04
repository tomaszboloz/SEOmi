use super::super::frontier::init_frontier;
use super::*;

#[test]
fn resumed_frontier_does_not_invent_sitemap_discovery() {
    let mut config = default_crawl_config(None);
    config.resume_frontier_urls = vec!["https://example.test/resumed".into()];
    let setup = setup(config);
    let mut sources = Default::default();
    let mut truncated = false;
    let outcome = init_frontier(&setup, &[], &mut sources, &mut truncated);
    assert_eq!(outcome.queue.len(), 2);
    assert_eq!(sources["https://example.test/resumed"][0].kind, "resume");
    assert!(sources["https://example.test/resumed"][0]
        .source_url
        .is_none());
    assert_eq!(sources["https://example.test/"][0].kind, "start");
}

#[test]
fn frontier_records_real_sitemap_and_link_evidence_and_deduplicates_queue() {
    let mut config = default_crawl_config(None);
    config.resume_frontier_urls = vec!["https://example.test/sitemap-page".into()];
    let setup = setup(config);
    let mut sources = std::collections::HashMap::new();
    let mut truncated = false;
    sources.insert(
        "https://example.test/link-page".into(),
        vec![source("link")],
    );
    let sitemap = vec![
        "https://example.test/sitemap-page".into(),
        "https://example.test/link-page".into(),
        "https://example.test/sitemap-page#fragment".into(),
    ];
    let outcome = init_frontier(&setup, &sitemap, &mut sources, &mut truncated);
    assert_eq!(outcome.queue.len(), 3);
    assert_eq!(
        sources["https://example.test/sitemap-page"][0].kind,
        "sitemap"
    );
    assert_eq!(sources["https://example.test/link-page"][0].kind, "link");
    assert_eq!(
        sources["https://example.test/link-page"][0]
            .anchor_text
            .as_deref(),
        Some("Observed anchor")
    );
    assert!(!truncated);
}

#[test]
fn list_frontier_rejects_unsafe_out_of_scope_and_filtered_seeds_before_queueing() {
    let mut config = default_crawl_config(None);
    config.list_mode = true;
    config.include_patterns = vec![".*allowed.*".into()];
    config.exclude_patterns = vec![".*private.*".into()];
    config.seed_urls = vec![
        "http://127.0.0.1/allowed".into(),
        "https://other.test/allowed".into(),
        "https://example.test/denied".into(),
        "https://example.test/allowed-private".into(),
        "https://example.test/allowed".into(),
    ];
    let setup = setup(config);
    let mut sources = Default::default();
    let mut truncated = false;
    let outcome = init_frontier(
        &setup,
        &["https://example.test/sitemap-allowed".into()],
        &mut sources,
        &mut truncated,
    );
    assert_eq!(
        outcome.queue.iter().cloned().collect::<Vec<_>>(),
        vec![("https://example.test/allowed".into(), 0)]
    );
    assert_eq!(outcome.rejected_urls.len(), 4);
    assert!(outcome.rejected_urls[0]
        .reason
        .contains("URL safety validation"));
    assert_eq!(
        outcome.rejected_urls[1].reason,
        "Outside configured crawl scope"
    );
    assert_eq!(outcome.rejected_urls[2].reason, "Excluded by crawl filter");
    assert_eq!(outcome.rejected_urls[3].reason, "Excluded by crawl filter");
    assert_eq!(sources["https://example.test/allowed"][0].kind, "seed");
    assert!(!sources.contains_key("https://example.test/sitemap-allowed"));
}

#[test]
fn completed_resume_pages_are_visited_without_fetch_or_new_provenance() {
    let mut config = default_crawl_config(None);
    config.resume_completed_urls = vec![
        "https://example.test/".into(),
        "https://example.test/done".into(),
    ];
    let setup = setup(config);
    let mut sources = Default::default();
    let mut truncated = false;
    let outcome = init_frontier(
        &setup,
        &["https://example.test/done".into()],
        &mut sources,
        &mut truncated,
    );
    assert!(outcome.queue.is_empty());
    assert_eq!(outcome.visited.len(), 2);
    assert!(sources.is_empty());
}
