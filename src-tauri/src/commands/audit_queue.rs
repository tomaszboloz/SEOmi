//! Project-scoped persistence for the multi-page audit queue.

mod executions;
mod paths;

pub use executions::{
    __cmd__acknowledge_project_audit_queue_execution,
    __cmd__acknowledge_project_audit_queue_result, __cmd__list_project_audit_queue_executions,
    __cmd__list_project_audit_queue_results,
    __tauri_command_name_acknowledge_project_audit_queue_execution,
    __tauri_command_name_acknowledge_project_audit_queue_result,
    __tauri_command_name_list_project_audit_queue_executions,
    __tauri_command_name_list_project_audit_queue_results,
    acknowledge_project_audit_queue_execution, acknowledge_project_audit_queue_result,
    list_project_audit_queue_executions, list_project_audit_queue_results,
};
pub(crate) use executions::{write_queue_execution, write_queue_result};
pub(crate) use paths::queue_path;

use crate::commands::crawl_storage;
use paths::{write_atomic, MAX_QUEUE_BYTES};
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use tauri::AppHandle;

#[tauri::command]
pub fn load_project_audit_queue(app: AppHandle, project_id: String) -> Result<Value, String> {
    let path = queue_path(&app, &project_id)?;
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Value::Null),
        Err(error) => return Err(format!("Unable to read audit queue: {error}")),
    };
    if bytes.len() > MAX_QUEUE_BYTES {
        return Err("Saved audit queue exceeds the safety limit.".into());
    }
    serde_json::from_slice(&bytes).map_err(|error| format!("Saved audit queue is invalid: {error}"))
}

pub(crate) fn read_queue_snapshot(
    app: &AppHandle,
    project_id: &str,
) -> Result<Option<Value>, String> {
    let path = queue_path(app, project_id)?;
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Unable to read audit queue: {error}")),
    };
    if bytes.len() > MAX_QUEUE_BYTES {
        return Err("Saved audit queue exceeds the safety limit.".into());
    }
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|error| format!("Saved audit queue is invalid: {error}"))
}

pub(crate) fn write_queue_snapshot(
    app: &AppHandle,
    project_id: &str,
    snapshot: &Value,
) -> Result<(), String> {
    if !snapshot.is_object() {
        return Err("Audit queue storage expects a JSON object.".into());
    }
    write_atomic(&queue_path(app, project_id)?, snapshot)
}

#[tauri::command]
pub fn save_project_audit_queue(
    app: AppHandle,
    project_id: String,
    snapshot: Value,
) -> Result<(), String> {
    write_queue_snapshot(&app, &project_id, &snapshot)
}

#[tauri::command]
pub fn delete_project_audit_queue(app: AppHandle, project_id: String) -> Result<(), String> {
    let path = queue_path(&app, &project_id)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Unable to remove audit queue: {error}")),
    }?;
    let directory = crawl_storage::project_directory(&app, &project_id)?;
    let entries = match fs::read_dir(&directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Unable to inspect audit queue files: {error}")),
    };
    for entry in entries {
        let path = entry
            .map_err(|error| format!("Unable to inspect audit queue file: {error}"))?
            .path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if name.starts_with("audit_queue_execution_")
            || name.starts_with("audit_queue_result_")
            || name.starts_with("audit_queue_execution_") && name.ends_with(".lock")
        {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn queue_snapshot_is_an_object() {
        assert!(json!({ "items": [], "run": null }).is_object());
        assert!(!json!([]).is_object());
    }
}
