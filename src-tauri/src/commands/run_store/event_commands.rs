use tauri::AppHandle;

use super::commands::open_store;
use super::events::{self, StoredCrawlEvent};

#[tauri::command]
pub fn store_append_crawl_events<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    events: Vec<StoredCrawlEvent>,
) -> Result<usize, String> {
    let mut conn = open_store(&app, &project_id)?;
    events::append_events(&mut conn, &project_id, &run_id, &events)
}

#[tauri::command]
pub fn store_load_crawl_events<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    from_seq: i64,
    limit: i64,
) -> Result<Vec<StoredCrawlEvent>, String> {
    let conn = open_store(&app, &project_id)?;
    events::load_events(&conn, &project_id, &run_id, from_seq, limit)
}
