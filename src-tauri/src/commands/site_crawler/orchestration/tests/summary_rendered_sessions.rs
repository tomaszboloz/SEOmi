use super::super::robots::CrawlRobotsOutcome;
use super::super::sitemaps::CrawlSitemapsOutcome;
use super::page_fetch_fixture::{empty_state, session};
use super::*;
use crate::commands::site_crawler::orchestration::summary::{
    build_crawl_result, BuildCrawlResultInput,
};

#[test]
fn building_the_result_closes_every_open_rendered_session() {
    let (app, rendered, _) = session(Vec::new(), false);
    let mut state = empty_state();
    state.rendered_sessions.push(rendered);
    let setup = setup(default_crawl_config(Some(10)));
    let handle = app.handle();
    let result = build_crawl_result(BuildCrawlResultInput {
        app: &handle,
        control: &CrawlControl::new(),
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
    });
    assert_eq!(result.pages_crawled, 0);
    assert!(state.rendered_sessions.is_empty());
}
