use super::super::robots::CrawlRobotsOutcome;
use super::super::sitemaps::CrawlSitemapsOutcome;
use super::*;
use crate::commands::site_crawler::models::CrawledPageSummary;
use crate::commands::site_crawler::orchestration::summary::{
    build_crawl_result, BuildCrawlResultInput,
};
use crate::utils::test_app::StorageApp;
use tauri::test::{mock_builder, MockRuntime};

fn page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 0, "schema_types": [],
        "schema_syntax_errors": 0, "hreflangs": [], "h1_count": 0,
        "heading_counts": [0, 0, 0, 0, 0, 0], "internal_link_count": 0,
        "external_link_count": 0, "links": [], "images": [], "issues_count": 0,
        "issues": []
    }))
    .unwrap()
}

fn empty_robots() -> CrawlRobotsOutcome {
    CrawlRobotsOutcome {
        robots_rules: Vec::new(),
        robots_txt_status: "disabled".into(),
        robots_txt_evaluation_status: "disabled".into(),
        robots_txt_warning: None,
        robots_txt_status_code: None,
        robots_txt_final_url: None,
        robots_txt_redirect_chain: Vec::new(),
        robots_sitemaps: Vec::new(),
        robots_crawl_delay: None,
        robots_agent_matrix: Vec::new(),
        robots_applicable_rules: Vec::new(),
        robots_sitemap_directives: Vec::new(),
    }
}

fn empty_sitemaps() -> CrawlSitemapsOutcome {
    CrawlSitemapsOutcome {
        sitemap_status: "disabled".into(),
        sitemap_urls: Vec::new(),
        discovery_sources_by_url: Default::default(),
        discovery_provenance_truncated: false,
        timed_out: false,
    }
}

#[test]
fn summary_prefetched_order_triggers_max_pages_limit_when_queue_empty() {
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let setup = setup(default_crawl_config(Some(1)));
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    state.pages.push(page("https://example.test/page"));
    state
        .prefetched_order
        .push_back(("https://example.test/prefetched".into(), 0));
    let handle = app.handle();
    let result = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots: empty_robots(),
        sitemaps: empty_sitemaps(),
        state: &mut state,
        resources: Vec::new(),
        resource_limit_reached: false,
    });
    assert!(result.limit_reasons.contains(&"max_pages".to_string()));
}

#[test]
fn summary_without_remaining_queue_or_prefetch_omits_max_pages() {
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let setup = setup(default_crawl_config(Some(1)));
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    state.pages.push(page("https://example.test/page"));
    let handle = app.handle();
    let result = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots: empty_robots(),
        sitemaps: empty_sitemaps(),
        state: &mut state,
        resources: Vec::new(),
        resource_limit_reached: false,
    });
    assert!(!result.limit_reasons.contains(&"max_pages".to_string()));
}
