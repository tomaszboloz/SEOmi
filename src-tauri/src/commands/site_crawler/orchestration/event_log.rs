//! Opens and closes the native crawl event log around one pipeline run (#138).
use serde_json::json;
use tauri::{AppHandle, Runtime};

use super::setup::CrawlSetup;
use crate::commands::run_store::commands::open_store;
use crate::commands::site_crawler::control::CrawlControl;
use crate::commands::site_crawler::event_recorder::{terminal_kind, EventRecorder};
use crate::commands::site_crawler::models::SiteCrawlResult;

/// Attaches a recorder and writes `started`; an unavailable store is reported, not fatal.
pub(super) fn start<R: Runtime>(
    app: &AppHandle<R>,
    control: &CrawlControl,
    setup: &CrawlSetup,
    project: &str,
) -> Result<(), String> {
    let conn = open_store(app, project)?;
    control.attach_recorder(
        &setup.run_id,
        EventRecorder::new(conn, project, &setup.run_id),
    );
    control.record_event(
        &setup.run_id,
        "started",
        &json!({
            "start_url": setup.normalized_start_url.as_str(),
            "limit": setup.limit,
            "crawl_mode": setup.config.crawl_mode,
        }),
    );
    Ok(())
}

/// Writes the terminal event that matches the pipeline outcome.
pub(super) fn finish(
    control: &CrawlControl,
    run_id: &str,
    outcome: &Result<SiteCrawlResult, String>,
) -> Option<String> {
    let (kind, pages) = match outcome {
        Ok(result) => (
            terminal_kind(result.cancelled, result.timed_out, false),
            result.pages.len(),
        ),
        Err(_) => (terminal_kind(false, false, true), 0),
    };
    control.finish_recorder(run_id, kind, pages)
}
