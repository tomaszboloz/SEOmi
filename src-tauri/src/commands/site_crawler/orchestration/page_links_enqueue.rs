use super::super::{
    models::{record_discovery_source, CrawledDiscoverySource},
    scope::matches_filters,
};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;
use tauri::Runtime;

pub fn record_internal_link_provenance<R: Runtime>(
    target_for_run: &str,
    final_url: &str,
    anchor_text: &str,
    state: &mut CrawlLoopState<R>,
) {
    state.discovery_provenance_truncated |= !record_discovery_source(
        &mut state.discovery_sources_by_url,
        target_for_run,
        CrawledDiscoverySource {
            kind: "link".into(),
            source_url: Some(final_url.to_string()),
            anchor_text: (!anchor_text.is_empty()).then(|| anchor_text.to_string()),
        },
    );
}

pub fn enqueue_frontier_link<R: Runtime>(
    url_str: String,
    depth: usize,
    is_nofollow: bool,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState<R>,
) {
    let eligible = (setup.config.follow_nofollow || !is_nofollow)
        && matches_filters(&url_str, &setup.include_patterns, &setup.exclude_patterns)
        && !state.visited.contains(&url_str);

    if !setup.config.list_mode && depth >= setup.max_depth && eligible {
        state.depth_limit_reached = true;
    }

    if !setup.config.list_mode
        && depth < setup.max_depth
        && eligible
        && state.queue.len() + state.pages.len() < setup.limit * 2
    {
        state.visited.insert(url_str.clone());
        state.queue.push_back((url_str, depth + 1));
    }
}
