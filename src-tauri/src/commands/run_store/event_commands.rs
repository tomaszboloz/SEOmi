//! IPC for the crawl event log (#138). The WebView only reads and closes logs;
//! the native crawler is the single writer.
use tauri::AppHandle;

use super::commands::open_store;
use super::event_read::{close_interrupted, load, open_runs};
use super::events::{EventPage, OpenRun};

#[tauri::command]
pub fn store_load_crawl_events<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    after_seq: i64,
    limit: usize,
) -> Result<EventPage, String> {
    load(
        &open_store(&app, &project_id)?,
        &project_id,
        &run_id,
        after_seq,
        limit,
    )
}

#[tauri::command]
pub fn store_list_open_crawl_event_runs<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<OpenRun>, String> {
    open_runs(&open_store(&app, &project_id)?, &project_id)
}

#[tauri::command]
pub fn store_close_interrupted_crawl_events<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    at_ms: i64,
) -> Result<(), String> {
    close_interrupted(
        &mut open_store(&app, &project_id)?,
        &project_id,
        &run_id,
        at_ms,
    )
}

#[cfg(test)]
#[path = "event_command_tests.rs"]
mod tests;
