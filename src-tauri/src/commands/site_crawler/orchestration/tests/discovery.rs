use super::super::page_discovery::resolve_page_discovery_sources;
use super::*;

#[test]
fn discovery_resolves_root_seed_and_unknown_page_without_inventing_link_evidence() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    let sources = resolve_page_discovery_sources("https://example.test/", &setup, &mut state);
    assert_eq!(sources[0].kind, "start");
    assert!(sources[0].source_url.is_none());
    assert!(
        resolve_page_discovery_sources("https://example.test/unknown", &setup, &mut state)
            .is_empty()
    );
    let mut config = default_crawl_config(None);
    config.list_mode = true;
    let list_setup = super::setup(config);
    assert_eq!(
        resolve_page_discovery_sources("https://example.test/seed", &list_setup, &mut state)[0]
            .kind,
        "seed"
    );
}

#[test]
fn discovery_moves_existing_sources_and_preserves_other_pages() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    state
        .discovery_sources_by_url
        .insert("https://example.test/".into(), vec![source("link")]);
    state
        .discovery_sources_by_url
        .insert("https://example.test/other".into(), vec![source("sitemap")]);
    let sources = resolve_page_discovery_sources("https://example.test/", &setup, &mut state);
    assert_eq!(sources[0].kind, "link");
    assert_eq!(sources[0].anchor_text.as_deref(), Some("Observed anchor"));
    assert_eq!(state.discovery_sources_by_url.len(), 1);
    assert!(state
        .discovery_sources_by_url
        .contains_key("https://example.test/other"));
}
