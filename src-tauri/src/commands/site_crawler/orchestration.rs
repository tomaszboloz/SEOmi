use tauri::AppHandle;

use super::{
    control::CrawlControl,
    models::{CrawlConfig, SiteCrawlResult},
};

mod frontier;
mod loop_runner;
mod page_assembler;
mod page_assembler_assets;
mod page_assembler_signals;
mod page_content;
mod page_discovery;
mod page_error;
mod page_extra;
mod page_extra_schema_pagination;
mod page_extra_social;
mod page_fetch;
mod page_headings;
mod page_links;
mod page_links_enqueue;
mod page_media;
mod page_media_build;
mod page_metadata;
mod page_metadata_canonical;
mod page_metadata_directives;
mod page_metadata_verdicts;
mod page_resources_discovery;
mod page_status_issues;
mod page_summary_builder;
mod page_title_meta;
mod resource_crawler;
mod robots;
mod selectors;
mod setup;
mod setup_client;
mod setup_config;
mod sitemaps;
mod state;
mod summary;

use frontier::init_frontier;
use loop_runner::run_crawl_loop;
use resource_crawler::crawl_secondary_resources;
use robots::fetch_and_eval_robots;
use selectors::CrawlSelectors;
use setup::CrawlSetup;
use sitemaps::discover_and_parse_sitemaps;
use state::CrawlLoopState;
use summary::build_crawl_result;

#[allow(clippy::too_many_arguments)]
pub async fn crawl_site_with_control(
    app: AppHandle,
    control: &CrawlControl,
    start_url: String,
    max_pages: Option<usize>,
    user_agent: Option<String>,
    run_id: Option<String>,
    project_id: Option<String>,
    config: Option<CrawlConfig>,
) -> Result<SiteCrawlResult, String> {
    let setup = CrawlSetup::init(
        start_url, max_pages, user_agent, run_id, project_id, config, control,
    )?;
    let robots = fetch_and_eval_robots(&setup).await?;
    let mut sitemaps = discover_and_parse_sitemaps(&setup, &robots.robots_sitemaps).await?;
    let frontier = init_frontier(
        &setup,
        &sitemaps.sitemap_urls,
        &mut sitemaps.discovery_sources_by_url,
        &mut sitemaps.discovery_provenance_truncated,
    );
    let mut state = CrawlLoopState::new(
        frontier.visited,
        frontier.queue,
        frontier.rejected_urls,
        std::mem::take(&mut sitemaps.discovery_sources_by_url),
        sitemaps.discovery_provenance_truncated,
        sitemaps.timed_out,
    );
    let selectors = CrawlSelectors::compile();

    run_crawl_loop(
        &app,
        control,
        &setup,
        &mut state,
        &selectors,
        &robots.robots_rules,
        robots.robots_crawl_delay,
    )
    .await;

    super::post_processing::annotate_page_relations(&mut state.pages, &setup.config.crawl_mode);
    super::duplicate_annotation::annotate_duplicates(&mut state.pages);

    let (resources, resource_limit_reached) =
        crawl_secondary_resources(&setup, control, &mut state, robots.robots_crawl_delay).await;

    Ok(build_crawl_result(
        &app,
        control,
        &setup,
        robots,
        sitemaps,
        &mut state,
        resources,
        resource_limit_reached,
    ))
}
