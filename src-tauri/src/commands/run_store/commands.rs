use rusqlite::Connection;
use serde_json::Value;
use std::fs;
use tauri::AppHandle;

use super::{records, runs, schema, shred};
use crate::commands::crawl_storage::project_directory;

pub(super) fn open_store<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<Connection, String> {
    // Reuse project id validation so ids can never escape the data folder.
    let directory = project_directory(app, project_id)?;
    let root = directory
        .parent()
        .and_then(|projects| projects.parent())
        .ok_or("Invalid data folder.")?;
    fs::create_dir_all(root).map_err(|error| format!("Unable to create data folder: {error}"))?;
    schema::open(&root.join("seomi_store.sqlite3"))
        .map_err(|error| format!("Unable to open store: {error}"))
}

pub(super) fn err(error: rusqlite::Error) -> String {
    format!("Store error: {error}")
}

#[tauri::command]
pub fn store_save_crawl_run<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run: Value,
) -> Result<(), String> {
    let mut conn = open_store(&app, &project_id)?;
    runs::save_run(&mut conn, &project_id, &run).map_err(err)
}

#[tauri::command]
pub fn store_list_crawl_runs<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<Value>, String> {
    runs::list_runs(&open_store(&app, &project_id)?, &project_id).map_err(err)
}

#[tauri::command]
pub fn store_load_crawl_run<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
) -> Result<Option<Value>, String> {
    runs::load_run(&open_store(&app, &project_id)?, &project_id, &run_id).map_err(err)
}

#[tauri::command]
pub fn store_load_crawl_pages<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    offset: i64,
    limit: i64,
) -> Result<Vec<Value>, String> {
    runs::load_pages(
        &open_store(&app, &project_id)?,
        &project_id,
        &run_id,
        offset,
        limit,
    )
    .map_err(err)
}

#[tauri::command]
pub fn store_delete_crawl_run<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
) -> Result<(), String> {
    runs::delete_run(&open_store(&app, &project_id)?, &project_id, &run_id)
        .map(|_| ())
        .map_err(err)
}

#[tauri::command]
pub fn store_import_legacy_runs<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    source: String,
    runs: Vec<Value>,
) -> Result<usize, String> {
    let mut conn = open_store(&app, &project_id)?;
    records::import_legacy_runs(&mut conn, &project_id, &source, &runs).map_err(err)
}

#[tauri::command]
pub fn store_put_record<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    kind: String,
    key: String,
    subject_id: Option<String>,
    data: Vec<u8>,
) -> Result<(), String> {
    let conn = open_store(&app, &project_id)?;
    match subject_id.filter(|subject| !subject.is_empty()) {
        Some(subject) => shred::put_encrypted(&conn, &project_id, &kind, &key, &subject, &data),
        None => records::put_record(&conn, &project_id, &kind, &key, "", "", &data).map_err(err),
    }
}

#[tauri::command]
pub fn store_get_record<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    kind: String,
    key: String,
) -> Result<Option<Vec<u8>>, String> {
    shred::read_record(&open_store(&app, &project_id)?, &project_id, &kind, &key)
}
