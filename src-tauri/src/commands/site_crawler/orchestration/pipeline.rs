use tauri::{AppHandle, Runtime};

use super::{
    frontier::init_frontier, resource_crawler::crawl_secondary_resources,
    robots::fetch_and_eval_robots, selectors::CrawlSelectors, setup::CrawlSetup,
    sitemaps::discover_and_parse_sitemaps, state::CrawlLoopState, summary::build_crawl_result,
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

    let conn = match setup.project_id.as_deref() {
        Some(pid) if !pid.trim().is_empty() => {
            Some(crate::commands::run_store::commands::open_store(app, pid)?)
        }
        _ => None,
    };
    let mut collector = Some(super::native_collector::NativeCrawlCollector::new(
        setup.project_id.clone(),
        setup.run_id.clone(),
        conn,
    ));

    super::loop_runner::run_crawl_loop_with_collector(
        app,
        control,
        setup,
        &mut state,
        &selectors,
        &robots.robots_rules,
        robots.robots_crawl_delay,
        &mut collector,
    )
    .await?;

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
