use super::super::{fetch_types::CrawlFetchFailure, models::CrawledDiscoverySource};
use super::setup_config::default_crawl_config;
use super::*;

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
mod frontier;
mod page_error;
mod setup_contracts;
mod setup_lifecycle;
mod state;
