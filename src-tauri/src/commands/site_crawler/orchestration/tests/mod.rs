use super::super::{fetch_types::CrawlFetchFailure, models::CrawledDiscoverySource};
use super::setup_config::default_crawl_config;
use super::*;
use super::{
    loop_runner::run_crawl_loop, robots::fetch_and_eval_robots, selectors::CrawlSelectors,
    sitemaps::discover_and_parse_sitemaps, state::CrawlLoopState,
};

fn setup(config: CrawlConfig) -> CrawlSetup {
    CrawlSetup::init(
        "https://example.test/".into(),
        None,
        None,
        Some("fixture-run".into()),
        None,
        Some(config),
        &CrawlControl::new(),
    )
    .unwrap()
}
fn state() -> CrawlLoopState {
    CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    )
}
fn source(kind: &str) -> CrawledDiscoverySource {
    CrawledDiscoverySource {
        kind: kind.into(),
        source_url: Some("https://example.test/source".into()),
        anchor_text: Some("Observed anchor".into()),
    }
}
fn failure(kind: &str) -> CrawlFetchFailure {
    CrawlFetchFailure {
        kind: kind.into(),
        message: "Observed fixture failure".into(),
    }
}

mod discovery;
mod discovery_http_fixture;
mod frontier;
mod frontier_normalization;
mod loop_runner_guards;
mod loop_runner_transport;
mod page_assembly;
mod page_directives;
mod page_error;
mod page_extra_edges;
mod page_extractors;
mod page_fetch_contracts;
mod page_fetch_fixture;
mod page_fetch_prefetch;
mod page_fixture;
mod page_frontier;
mod page_link_contracts;
mod page_media_direct;
mod page_metadata;
mod page_metadata_verdicts_direct;
mod page_render_mismatch;
mod page_render_status;
mod page_resources_discovery_contracts;
mod page_semantic_language;
mod page_signals;
mod page_summary;
mod page_summary_provenance;
mod page_text;
mod pipeline_runtime;
mod pipeline_scope;
mod rendered_prefetch;
mod rendered_prefetch_edges;
mod rendered_prefetch_guards;
mod rendered_prefetch_inflight;
mod resource_contracts;
mod resource_deadlines;
mod resource_regressions;
mod robots_contracts;
mod runtime_generic;
mod setup_client_contracts;
mod setup_client_coverage;
mod setup_client_profile_contracts;
mod setup_client_profile_fixture;
mod setup_contracts;
mod setup_lifecycle;
mod sitemap_contracts;
mod sitemap_limits;
mod sitemap_regressions;
mod state;
mod summary_limits;
