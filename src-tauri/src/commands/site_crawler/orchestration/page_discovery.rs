use super::super::models::CrawledDiscoverySource;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub fn resolve_page_discovery_sources(
    current_url: &str,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
) -> Vec<CrawledDiscoverySource> {
    let is_start_url =
        !setup.config.list_mode && current_url == setup.normalized_start_url.to_string();
    let initial = if is_start_url {
        vec![CrawledDiscoverySource {
            kind: "start".into(),
            source_url: None,
            anchor_text: None,
        }]
    } else if setup.config.list_mode {
        vec![CrawledDiscoverySource {
            kind: "seed".into(),
            source_url: None,
            anchor_text: None,
        }]
    } else {
        Vec::new()
    };
    state
        .discovery_sources_by_url
        .remove(current_url)
        .unwrap_or(initial)
}
