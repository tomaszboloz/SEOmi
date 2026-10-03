use super::super::page_links_enqueue::{enqueue_frontier_link, record_internal_link_provenance};
use super::*;

#[test]
fn frontier_filter_list_mode_visited_depth_and_capacity_preserve_ownership() {
    for kind in [
        "exclude", "include", "list", "visited", "depth", "capacity", "eligible",
    ] {
        let mut config = default_crawl_config(Some(1));
        config.exclude_patterns = if kind == "exclude" {
            vec!["next".into()]
        } else {
            vec![]
        };
        config.include_patterns = if kind == "include" {
            vec!["other".into()]
        } else {
            vec![]
        };
        config.list_mode = kind == "list";
        config.max_depth = Some(if kind == "depth" { 0 } else { 1 });
        let setup = setup(config);
        let mut state = state();
        let url = "https://example.test/next";
        if kind == "visited" {
            state.visited.insert(url.into());
        }
        if kind == "capacity" {
            state
                .queue
                .extend([("first".into(), 0), ("second".into(), 0)]);
        }
        enqueue_frontier_link(url.into(), 0, false, &setup, &mut state);
        assert_eq!(
            state.queue.iter().any(|(target, _)| target == url),
            kind == "eligible"
        );
        assert_eq!(state.depth_limit_reached, kind == "depth");
        assert_eq!(
            state.visited.contains(url),
            kind == "eligible" || kind == "visited"
        );
    }
}

#[test]
fn provenance_deduplicates_sources_and_reports_saturation_without_losing_existing_evidence() {
    let mut state = state();
    let url = "https://example.test/next";
    record_internal_link_provenance(url, "https://example.test/", "", &mut state);
    record_internal_link_provenance(url, "https://example.test/", "", &mut state);
    assert_eq!(state.discovery_sources_by_url[url].len(), 1);
    assert!(state.discovery_sources_by_url[url][0].anchor_text.is_none());
    assert!(!state.discovery_provenance_truncated);
    for i in 0..16 {
        record_internal_link_provenance(
            url,
            &format!("https://example.test/{i}"),
            "Observed anchor",
            &mut state,
        );
    }
    assert_eq!(state.discovery_sources_by_url[url].len(), 16);
    assert!(state.discovery_provenance_truncated);
    assert_eq!(
        state.discovery_sources_by_url[url][1]
            .anchor_text
            .as_deref(),
        Some("Observed anchor")
    );
    assert_eq!(
        state.discovery_sources_by_url[url][0].source_url.as_deref(),
        Some("https://example.test/")
    );
}

#[test]
fn nofollow_target_is_not_enqueued_when_following_is_disabled() {
    let mut config = default_crawl_config(None);
    config.max_depth = Some(0);
    let mut state = state();
    enqueue_frontier_link(
        "https://example.test/next".into(),
        0,
        true,
        &setup(config),
        &mut state,
    );
    assert!(state.queue.is_empty() && state.visited.is_empty());
    assert!(!state.depth_limit_reached);
}
