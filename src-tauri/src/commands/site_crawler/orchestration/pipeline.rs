use tauri::{AppHandle, Runtime};

use super::{
    frontier::init_frontier, loop_runner::run_crawl_loop,
    resource_crawler::crawl_secondary_resources, robots::fetch_and_eval_robots,
    selectors::CrawlSelectors, setup::CrawlSetup, sitemaps::discover_and_parse_sitemaps,
    state::CrawlLoopState, summary::build_crawl_result,
};
use crate::commands::site_crawler::{control::CrawlControl, models::SiteCrawlResult};

pub(super) async fn run_crawl_pipeline<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
) -> Result<SiteCrawlResult, String> {
    let robots = fetch_and_eval_robots(setup).await?;
    let mut sitemaps = discover_and_parse_sitemaps(setup, &robots.robots_sitemaps).await?;
    let frontier = init_frontier(
        setup,
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
        app,
        control,
        setup,
        &mut state,
        &selectors,
        &robots.robots_rules,
        robots.robots_crawl_delay,
    )
    .await;

    super::super::post_processing::annotate_page_relations(
        &mut state.pages,
        &setup.config.crawl_mode,
    );
    super::super::duplicate_annotation::annotate_duplicates(&mut state.pages);
    let (resources, resource_limit_reached) =
        crawl_secondary_resources(setup, control, &mut state, robots.robots_crawl_delay).await;

    Ok(build_crawl_result(super::summary::BuildCrawlResultInput {
        app,
        control,
        setup,
        robots,
        sitemaps,
        state: &mut state,
        resources,
        resource_limit_reached,
    }))
}
