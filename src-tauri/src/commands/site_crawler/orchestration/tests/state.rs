use super::*;

#[test]
fn loop_state_preserves_frontier_and_provenance_without_inventing_completed_work() {
    let visited = ["https://example.test/".to_string()].into_iter().collect();
    let queue = [("https://example.test/", 0)]
        .into_iter()
        .map(|(url, depth)| (url.to_string(), depth))
        .collect();
    let mut sources = std::collections::HashMap::new();
    sources.insert("https://example.test/".into(), vec![source("start")]);
    let state: CrawlLoopState =
        CrawlLoopState::new(visited, queue, Vec::new(), sources, true, true);
    assert!(state.visited.contains("https://example.test/"));
    assert_eq!(
        state.queue.front().unwrap(),
        &("https://example.test/".to_string(), 0)
    );
    assert_eq!(
        state.discovery_sources_by_url["https://example.test/"][0].kind,
        "start"
    );
    assert!(state.discovery_provenance_truncated && state.timed_out);
    assert!(
        state.pages.is_empty()
            && state.rejected_urls.is_empty()
            && state.resource_candidates.is_empty()
    );
    assert_eq!(
        state.custom_search_remaining_chars,
        crate::services::custom_search::MAX_CUSTOM_SEARCH_CHARS_PER_RUN
    );
    assert_eq!(state.robots_blocked_count, 0);
    assert!(!state.depth_limit_reached);
    assert!(
        state.last_page_request_at.is_none()
            && state.rendered_sessions.is_empty()
            && state.render_health.rendering_enabled()
            && state.render_health.fallback_pages == 0
    );
    assert!(state.prefetched_order.is_empty() && state.prefetched_responses.is_empty());
}
