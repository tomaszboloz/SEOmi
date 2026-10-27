use tauri::{AppHandle, Runtime};

use super::native_collector::NativeCrawlCollector;
use super::{
    frontier::init_frontier, loop_runner::run_crawl_loop_with_collector,
    resource_crawler::crawl_secondary_resources, robots::fetch_and_eval_robots,
    selectors::CrawlSelectors, setup::CrawlSetup, sitemaps::discover_and_parse_sitemaps,
    state::CrawlLoopState, summary::build_crawl_result,
};
use crate::commands::run_store::commands::open_store;
use crate::commands::site_crawler::{control::CrawlControl, models::SiteCrawlResult};

pub(super) async fn run_crawl_pipeline<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
) -> Result<SiteCrawlResult, String> {
    let mut collector = match setup
        .project_id
        .as_deref()
        .filter(|id| !id.trim().is_empty())
    {
        Some(project_id) => Some(NativeCrawlCollector::new(
            Some(project_id.to_owned()),
            setup.run_id.clone(),
            Some(open_store(app, project_id)?),
        )?),
        None => None,
    };
    if let Some(col) = collector.as_mut() {
        let config = serde_json::to_value(&setup.config).map_err(|e| e.to_string())?;
        col.record_started(&setup.normalized_start_url.to_string(), &config)?;
    }
    let robots = match fetch_and_eval_robots(setup).await {
        Ok(value) => value,
        Err(error) => {
            if let Some(col) = collector.as_mut() {
                col.record_interrupted(&setup.normalized_start_url.to_string(), 0, &error)?;
            }
            return Err(error);
        }
    };
    let mut sitemaps = match discover_and_parse_sitemaps(setup, &robots.robots_sitemaps).await {
        Ok(value) => value,
        Err(error) => {
            if let Some(col) = collector.as_mut() {
                col.record_interrupted(&setup.normalized_start_url.to_string(), 0, &error)?;
            }
            return Err(error);
        }
    };
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

    if let Err(error) = run_crawl_loop_with_collector(
        app,
        control,
        setup,
        &mut state,
        &selectors,
        &robots.robots_rules,
        robots.robots_crawl_delay,
        &mut collector,
    )
    .await
    {
        if let Some(col) = collector.as_mut() {
            col.record_interrupted(
                &setup.normalized_start_url.to_string(),
                state.pages.len(),
                &error,
            )?;
        }
        return Err(error);
    }

    super::super::post_processing::annotate_page_relations(
        &mut state.pages,
        &setup.config.crawl_mode,
    );
    super::super::duplicate_annotation::annotate_duplicates(&mut state.pages);
    let (resources, resource_limit_reached) =
        crawl_secondary_resources(setup, control, &mut state, robots.robots_crawl_delay).await;

    let result = build_crawl_result(super::summary::BuildCrawlResultInput {
        app,
        control,
        setup,
        robots,
        sitemaps,
        state: &mut state,
        resources,
        resource_limit_reached,
    });
    if let Some(col) = collector.as_mut() {
        if result.cancelled {
            col.record_cancelled(&result.start_url, result.pages.len(), result.duration_ms)?;
        } else if result.timed_out {
            col.record_timed_out(&result.start_url, result.pages.len(), result.duration_ms)?;
        } else {
            col.record_completed(
                &result.start_url,
                result.pages.len(),
                f64::from(result.health_score),
                result.duration_ms,
            )?;
        }
    }
    Ok(result)
}
