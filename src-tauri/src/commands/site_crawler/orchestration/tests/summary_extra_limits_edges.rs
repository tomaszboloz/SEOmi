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
fn summary_reports_depth_robots_unknown_and_render_fallback() {
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let setup = setup(default_crawl_config(Some(10)));
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    state.depth_limit_reached = true;
    state.render_health.fallback_pages = 2;
    let mut robots = empty_robots();
    robots.robots_txt_evaluation_status = "unknown".into();

    let handle = app.handle();
    let result = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots,
        sitemaps: empty_sitemaps(),
        state: &mut state,
        resources: Vec::new(),
        resource_limit_reached: false,
    });
    assert!(result.limit_reasons.contains(&"max_depth".to_string()));
    assert!(result.limit_reasons.contains(&"robots_unknown".to_string()));
    assert!(result
        .limit_reasons
        .contains(&"render_fallback".to_string()));
}

#[test]
fn summary_handles_empty_and_diverse_populated_page_lists() {
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    let setup = setup(default_crawl_config(Some(10)));
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    let handle = app.handle();
    let empty_res = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots: empty_robots(),
        sitemaps: empty_sitemaps(),
        state: &mut state,
        resources: Vec::new(),
        resource_limit_reached: false,
    });
    assert_eq!(empty_res.pages_crawled, 0);
    assert_eq!(empty_res.health_score, 100);

    let mut p1 = page("https://example.test/fast");
    p1.http_status = 200;
    p1.response_time_ms = 40;
    p1.title = Some("Fast".into());

    let mut p2 = page("https://example.test/slow");
    p2.http_status = 404;
    p2.response_time_ms = 2500;

    let mut populated_state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    populated_state.pages = vec![p1, p2];

    let pop_res = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots: empty_robots(),
        sitemaps: empty_sitemaps(),
        state: &mut populated_state,
        resources: Vec::new(),
        resource_limit_reached: false,
    });
    assert_eq!(pop_res.pages_crawled, 2);
    assert_eq!(pop_res.pages.len(), 2);
}
