use super::paths::{
    queue_execution_path, queue_result_path, write_atomic_with_limit, MAX_QUEUE_EXECUTION_BYTES,
    MAX_QUEUE_RESULT_BYTES,
};
use crate::commands::crawl_storage;
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use tauri::AppHandle;

pub(crate) fn write_queue_execution<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    run_id: &str,
    execution: &Value,
) -> Result<(), String> {
    let bytes = serde_json::to_vec(execution)
        .map_err(|error| format!("Unable to serialize audit queue execution: {error}"))?;
    if bytes.len() > MAX_QUEUE_EXECUTION_BYTES {
        return Err("Audit queue execution exceeds the safety limit.".into());
    }
    let path = queue_execution_path(app, project_id, run_id)?;
    write_atomic_with_limit(&path, execution, MAX_QUEUE_EXECUTION_BYTES)
}

pub(crate) fn write_queue_result<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    run_id: &str,
    item_id: &str,
    result: &Value,
) -> Result<(), String> {
    let bytes = serde_json::to_vec(result)
        .map_err(|error| format!("Unable to serialize audit queue result: {error}"))?;
    if bytes.len() > MAX_QUEUE_RESULT_BYTES {
        return Err("Audit queue result exceeds the safety limit.".into());
    }
    write_atomic_with_limit(
        &queue_result_path(app, project_id, run_id, item_id)?,
        result,
        MAX_QUEUE_RESULT_BYTES,
    )
}

#[tauri::command]
pub fn list_project_audit_queue_executions<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<Value>, String> {
    let directory = crawl_storage::project_directory(&app, &project_id)?;
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Unable to list audit queue executions: {error}")),
    };
    let mut executions = Vec::new();
    for entry in entries {
        let path = entry
            .map_err(|error| format!("Unable to read audit queue execution entry: {error}"))?
            .path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.starts_with("audit_queue_execution_") || !name.ends_with(".json") {
            continue;
        }
        let bytes = crawl_storage::read_bytes_bounded(&path, MAX_QUEUE_EXECUTION_BYTES)
            .map_err(|error| format!("Unable to read audit queue execution: {error}"))?;
        executions.push(
            serde_json::from_slice(&bytes)
                .map_err(|error| format!("Saved audit queue execution is invalid: {error}"))?,
        );
        if executions.len() >= 100 {
            break;
        }
    }
    Ok(executions)
}

#[tauri::command]
pub fn list_project_audit_queue_results<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<Value>, String> {
    let directory = crawl_storage::project_directory(&app, &project_id)?;
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Unable to list audit queue results: {error}")),
    };
    let mut results = Vec::new();
    for entry in entries {
        let path = entry
            .map_err(|error| format!("Unable to read audit queue result entry: {error}"))?
            .path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.starts_with("audit_queue_result_") || !name.ends_with(".json") {
            continue;
        }
        let bytes = crawl_storage::read_bytes_bounded(&path, MAX_QUEUE_RESULT_BYTES)
            .map_err(|error| format!("Unable to read audit queue result: {error}"))?;
        results.push(
            serde_json::from_slice(&bytes)
                .map_err(|error| format!("Saved audit queue result is invalid: {error}"))?,
        );
        if results.len() >= 50_000 {
            break;
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn acknowledge_project_audit_queue_result<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    item_id: String,
) -> Result<(), String> {
    let path = queue_result_path(&app, &project_id, &run_id, &item_id)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Unable to acknowledge audit queue result: {error}")),
    }
}

#[tauri::command]
pub fn acknowledge_project_audit_queue_execution<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
) -> Result<(), String> {
    let path = queue_execution_path(&app, &project_id, &run_id)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Unable to acknowledge audit queue execution: {error}"
        )),
    }
}
