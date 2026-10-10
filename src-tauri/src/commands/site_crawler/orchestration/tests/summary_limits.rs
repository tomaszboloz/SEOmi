use super::super::robots::CrawlRobotsOutcome;
use super::super::sitemaps::CrawlSitemapsOutcome;
use super::*;
use crate::commands::site_crawler::models::{
    CrawledPageIssue, CrawledPageSummary, SiteCrawlResult,
};
use crate::commands::site_crawler::orchestration::summary::{
    build_crawl_result, BuildCrawlResultInput,
};
use crate::utils::test_app::StorageApp;
use tauri::test::{mock_builder, MockRuntime};
#[path = "summary_score_version.rs"]
mod score_version;

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

fn result_for_pages(pages: Vec<CrawledPageSummary>) -> SiteCrawlResult {
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
    state.pages = pages;
    let handle = app.handle();
    build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots: CrawlRobotsOutcome {
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
        },
        sitemaps: CrawlSitemapsOutcome {
            sitemap_status: "disabled".into(),
            sitemap_urls: Vec::new(),
            discovery_sources_by_url: Default::default(),
            discovery_provenance_truncated: false,
            timed_out: false,
        },
        state: &mut state,
        resources: Vec::new(),
        resource_limit_reached: false,
    })
}

#[test]
fn generic_summary_reports_each_reached_limit() {
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
    let mut page = page("https://example.test/page");
    page.body_truncated = true;
    page.issues.push(CrawledPageIssue {
        severity: "Warning".into(),
        message: "Redirect limit reached".into(),
    });
    state.pages.push(page);
    state
        .queue
        .push_back(("https://example.test/queued".into(), 1));
    state.timed_out = true;
    let handle = app.handle();
    let result = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &control,
        setup: &setup,
        robots: CrawlRobotsOutcome {
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
        },
        sitemaps: CrawlSitemapsOutcome {
            sitemap_status: "disabled".into(),
            sitemap_urls: Vec::new(),
            discovery_sources_by_url: Default::default(),
            discovery_provenance_truncated: false,
            timed_out: false,
        },
        state: &mut state,
        resources: Vec::new(),
        resource_limit_reached: true,
    });

    assert_eq!(
        result.limit_reasons,
        vec![
            "max_pages",
            "max_response_bytes",
            "max_run_seconds",
            "max_redirects",
            "max_resource_requests"
        ]
    );
}

#[test]
fn generic_summary_ignores_non_html_body_limit() {
    let mut binary = page("https://example.test/press-kit.zip");
    binary.content_type = Some("application/zip".into());
    binary.body_truncated = true;
    let result = result_for_pages(vec![binary]);
    assert!(!result
        .limit_reasons
        .iter()
        .any(|reason| reason == "max_response_bytes"));
}
