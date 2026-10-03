use crate::commands::crawl_storage;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

pub(crate) const MAX_QUEUE_BYTES: usize = 16 * 1024 * 1024;
pub(crate) const MAX_QUEUE_EXECUTION_BYTES: usize = 64 * 1024 * 1024;
pub(crate) const MAX_QUEUE_RESULT_BYTES: usize = 8 * 1024 * 1024;

pub(crate) fn queue_path(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(crawl_storage::project_directory(app, project_id)?.join("audit_queue.json"))
}

pub(crate) fn queue_execution_path(
    app: &AppHandle,
    project_id: &str,
    run_id: &str,
) -> Result<PathBuf, String> {
    if run_id.is_empty()
        || run_id.len() > 80
        || !run_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid audit queue run identifier.".into());
    }
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("audit_queue_execution_{run_id}.json")))
}

pub(crate) fn queue_result_path(
    app: &AppHandle,
    project_id: &str,
    run_id: &str,
    item_id: &str,
) -> Result<PathBuf, String> {
    for value in [run_id, item_id] {
        if value.is_empty()
            || value.len() > 80
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        {
            return Err("Invalid audit queue result identifier.".into());
        }
    }
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("audit_queue_result_{run_id}_{item_id}.json")))
}

pub(crate) fn write_atomic(path: &std::path::Path, value: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(value)
        .map_err(|error| format!("Unable to serialize audit queue: {error}"))?;
    if bytes.len() > MAX_QUEUE_BYTES {
        return Err("Audit queue exceeds the safety limit.".into());
    }
    let directory = path
        .parent()
        .ok_or_else(|| "Audit queue path has no parent directory.".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Unable to create audit queue directory: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    if let Err(error) = fs::write(&temporary, bytes) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to write audit queue: {error}"));
    }
    if let Err(error) = crawl_storage::replace_file(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to finalize audit queue: {error}"));
    }
    Ok(())
}
