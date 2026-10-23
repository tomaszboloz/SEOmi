use std::{fs, io::ErrorKind};
use tauri::AppHandle;

use super::commands::open_store;
use super::{erase, report};
use crate::commands::crawl_storage::project_directory;

fn remove_legacy_history<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<(), String> {
    let directory = project_directory(app, project_id)?;
    let mut failure = None;
    for name in ["crawl_runs.json", "crawl_runs.json.bak"] {
        match fs::remove_file(directory.join(name)) {
            Ok(()) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) if failure.is_none() => {
                failure = Some(format!("Unable to remove legacy crawl history: {error}"));
            }
            Err(_) => {}
        }
    }
    failure.map_or(Ok(()), Err)
}

#[tauri::command]
pub fn store_forget_subject<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    subject_id: String,
) -> Result<report::ErasureReport, String> {
    let mut conn = open_store(&app, &project_id)?;
    let report = erase::forget_subject(&mut conn, &project_id, &subject_id)?;
    drop(conn);
    remove_legacy_history(&app, &project_id)?;
    Ok(report)
}

#[tauri::command]
pub fn store_erase_project<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<report::ErasureReport, String> {
    let mut conn = open_store(&app, &project_id)?;
    let report = erase::erase_project(&mut conn, &project_id)?;
    drop(conn);
    remove_legacy_history(&app, &project_id)?;
    Ok(report)
}

#[tauri::command]
pub fn store_erasure_log<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<report::ErasureReport>, String> {
    report::audit_log(&open_store(&app, &project_id)?, &project_id)
}
