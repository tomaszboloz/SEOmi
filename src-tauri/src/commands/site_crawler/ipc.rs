use tauri::{AppHandle, State};

use super::{
    control::CrawlControl, models::CrawlConfig, orchestration::crawl_site_with_control,
    SiteCrawlResult,
};

#[tauri::command]
pub fn cancel_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    control
        .cancelled_runs
        .lock()
        .map_err(|_| "Crawler cancellation state is unavailable.".to_string())?
        .insert(run_id);
    Ok(())
}

#[tauri::command]
pub fn pause_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    if control.is_cancelled(&run_id) {
        return Err("Cannot pause a cancelled crawl.".into());
    }
    control.pause(&run_id);
    Ok(())
}

#[tauri::command]
pub fn resume_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    control.resume(&run_id);
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn crawl_site(
    app: AppHandle,
    control: State<'_, CrawlControl>,
    start_url: String,
    max_pages: Option<usize>,
    user_agent: Option<String>,
    run_id: Option<String>,
    project_id: Option<String>,
    config: Option<CrawlConfig>,
) -> Result<SiteCrawlResult, String> {
    crawl_site_with_control(
        app, &control, start_url, max_pages, user_agent, run_id, project_id, config,
    )
    .await
}
