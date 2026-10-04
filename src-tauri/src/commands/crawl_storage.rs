use serde_json::Value;
use std::{fs, io};
use tauri::AppHandle;

mod encoding;
mod fs_atomic;
mod history;
#[cfg(test)]
mod tests;

pub(crate) use encoding::*;
pub(crate) use fs_atomic::*;
pub(crate) use history::*;

#[tauri::command]
pub fn load_project_crawl_runs<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Value, String> {
    let path = project_directory(&app, &project_id)?.join("crawl_runs.json");
    load_crawl_history_with_recovery(&path)
}

#[tauri::command]
pub fn save_project_crawl_runs<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    crawl_runs: Value,
) -> Result<(), String> {
    let Value::Array(runs) = &crawl_runs else {
        return Err("Crawl run storage expects a JSON array.".into());
    };
    if runs.len() > 50 {
        return Err("A project can store at most 50 crawl runs.".into());
    }
    let directory = project_directory(&app, &project_id)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create project crawl folder: {error}"))?;
    let destination = directory.join("crawl_runs.json");
    let bytes = encode_crawl_runs(&crawl_runs)?;
    write_bytes_atomic(&destination, &bytes)
        .map_err(|error| format!("Unable to persist saved crawl runs: {error}"))?;
    let backup = directory.join("crawl_runs.json.bak");
    if backup.exists() && fs::remove_file(&backup).is_err() {
        crate::utils::logging::diagnostic(
            crate::utils::logging::Diagnostic::CrawlBackupCleanupFailed,
        );
    }
    Ok(())
}

/// Load the small, project-scoped descriptor used to resume a crawl after a
/// desktop restart.
#[tauri::command]
pub fn load_project_crawl_checkpoint<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Value, String> {
    let path = project_directory(&app, &project_id)?.join("crawl_checkpoint.json");
    if !path.exists() {
        return Ok(Value::Null);
    }
    let bytes = read_bytes_bounded(&path, MAX_CHECKPOINT_BYTES)
        .map_err(|error| format!("Unable to read saved crawl checkpoint: {error}"))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Saved crawl checkpoint is invalid: {error}"))
}

/// Atomically persist a bounded project-scoped crawl checkpoint.
#[tauri::command]
pub fn save_project_crawl_checkpoint<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    checkpoint: Value,
) -> Result<(), String> {
    if !checkpoint.is_object() {
        return Err("Crawl checkpoint storage expects a JSON object.".into());
    }
    let bytes = serde_json::to_vec(&checkpoint)
        .map_err(|error| format!("Unable to serialize crawl checkpoint: {error}"))?;
    if bytes.len() > MAX_CHECKPOINT_BYTES {
        return Err("Crawl checkpoint exceeds the 32 MiB safety limit.".into());
    }
    let directory = project_directory(&app, &project_id)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create project crawl folder: {error}"))?;
    let destination = directory.join("crawl_checkpoint.json");
    write_bytes_atomic(&destination, &bytes)
        .map_err(|error| format!("Unable to persist crawl checkpoint: {error}"))
}

#[tauri::command]
pub fn delete_project_crawl_checkpoint<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<(), String> {
    let path = project_directory(&app, &project_id)?.join("crawl_checkpoint.json");
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Unable to delete crawl checkpoint: {error}")),
    }
}

#[cfg(test)]
#[path = "crawl_storage/command_tests/mod.rs"]
mod command_tests;
