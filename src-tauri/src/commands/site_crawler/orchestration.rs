use tauri::{AppHandle, Runtime};

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
mod pipeline;
mod resource_crawler;
mod robots;
mod selectors;
mod setup;
mod setup_client;
mod setup_config;
mod sitemaps;
mod state;
mod summary;

use pipeline::run_crawl_pipeline;
use setup::CrawlSetup;

#[allow(clippy::too_many_arguments)]
pub async fn crawl_site_with_control<R: Runtime>(
    app: AppHandle<R>,
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
    run_crawl_pipeline(&app, control, &setup).await
}

#[cfg(test)]
#[path = "orchestration/tests/page_media_build_contracts.rs"]
mod page_media_build_contracts;
#[cfg(test)]
#[path = "orchestration/tests/mod.rs"]
mod tests;
