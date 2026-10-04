use super::super::page_error::handle_page_error;
use super::*;

#[test]
fn cancelled_fetch_does_not_create_a_page_or_consume_discovery_evidence() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    state
        .discovery_sources_by_url
        .insert("https://example.test/".into(), vec![source("link")]);
    assert!(!handle_page_error(
        &setup,
        &mut state,
        "https://example.test/",
        2,
        31,
        failure("cancelled")
    ));
    assert!(state.pages.is_empty());
    assert_eq!(
        state.discovery_sources_by_url["https://example.test/"][0]
            .anchor_text
            .as_deref(),
        Some("Observed anchor")
    );
}

#[test]
fn failed_root_has_uncertain_indexing_and_no_invented_page_measurements() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    assert!(handle_page_error(
        &setup,
        &mut state,
        "https://example.test/",
        2,
        31,
        failure("timeout")
    ));
    let page = &state.pages[0];
    assert_eq!(
        (page.url.as_str(), page.final_url.as_str()),
        ("https://example.test/", "https://example.test/")
    );
    assert_eq!(
        (page.depth, page.response_time_ms, page.http_status),
        (2, 31, 0)
    );
    assert_eq!(page.request_error_kind.as_deref(), Some("timeout"));
    assert_eq!(page.indexability_status, "Uncertain");
    assert_eq!(page.discovery_sources[0].kind, "start");
    assert_eq!(page.issues_count, 1);
    assert_eq!(page.issues[0].severity, "Critical");
    assert_eq!(
        page.issues[0].message,
        "Fetch failed: Observed fixture failure"
    );
    assert!(page.title.is_none() && page.meta_description.is_none() && page.canonical.is_none());
    assert!(page.robots_decision.is_none() && page.indexability_verdict.is_none());
    assert!(
        page.rendered_lcp_ms.is_none()
            && page.rendered_inp_ms.is_none()
            && page.rendered_cls.is_none()
    );
    assert!(page.content_hash.is_none() && page.content_simhash.is_none());
    assert!(
        page.semantic_terms.is_empty()
            && page.semantic_links.is_empty()
            && page.semantic_excerpts.is_empty()
    );
    assert_eq!(
        (
            page.semantic_content_source.as_str(),
            page.semantic_content_provenance.as_str()
        ),
        ("none", "none")
    );
    assert!(page.schema_types.is_empty() && page.links.is_empty() && page.images.is_empty());
    assert!(page.content_type.is_none() && page.content_length.is_none());
    assert!(page.text_ratio_percent.is_none() && page.reading_time_minutes.is_none());
}

#[test]
fn failure_discovery_uses_list_seed_or_unknown_without_claiming_root_ownership() {
    for list_mode in [false, true] {
        let mut config = default_crawl_config(None);
        config.list_mode = list_mode;
        let setup = setup(config);
        let mut state = state();
        assert!(handle_page_error(
            &setup,
            &mut state,
            "https://example.test/child",
            1,
            5,
            failure("dns")
        ));
        let sources = &state.pages[0].discovery_sources;
        if list_mode {
            assert_eq!(sources[0].kind, "seed");
            assert!(sources[0].source_url.is_none());
        } else {
            assert!(sources.is_empty());
        }
    }
}

#[test]
fn existing_discovery_provenance_is_moved_only_for_the_failed_url() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    state
        .discovery_sources_by_url
        .insert("https://example.test/".into(), vec![source("link")]);
    state
        .discovery_sources_by_url
        .insert("https://example.test/other".into(), vec![source("sitemap")]);
    assert!(handle_page_error(
        &setup,
        &mut state,
        "https://example.test/",
        0,
        5,
        failure("tls")
    ));
    assert_eq!(state.pages[0].discovery_sources[0].kind, "link");
    assert_eq!(
        state.pages[0].discovery_sources[0].anchor_text.as_deref(),
        Some("Observed anchor")
    );
    assert!(!state
        .discovery_sources_by_url
        .contains_key("https://example.test/"));
    assert!(state
        .discovery_sources_by_url
        .contains_key("https://example.test/other"));
}
