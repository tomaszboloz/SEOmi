use super::models::*;
use crate::commands::crawl_storage;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[cfg(test)]
#[path = "storage_edge_tests.rs"]
mod edge_tests;
#[cfg(test)]
#[path = "storage_tests.rs"]
mod tests;

pub(super) fn task_path<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    schedule_id: &str,
) -> Result<PathBuf, String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("scheduled_task_{schedule_id}.json")))
}

pub(super) fn execution_path<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    schedule_id: &str,
) -> Result<PathBuf, String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("scheduled_execution_{schedule_id}.json")))
}

pub(super) fn result_path<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    schedule_id: &str,
) -> Result<PathBuf, String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("scheduled_result_{schedule_id}.json")))
}

pub(super) fn validate_handoff_identity(
    project_id: &str,
    schedule_id: &str,
    handoff: &ScheduledExecutionHandoff,
) -> Result<(), String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    validate_project_and_schedule(&handoff.project_id, &handoff.schedule_id)?;
    if handoff.project_id != project_id || handoff.schedule_id != schedule_id {
        return Err("Scheduled execution handoff does not match its storage path.".into());
    }
    Ok(())
}

pub(super) fn write_json_atomic(
    path: &std::path::Path,
    value: &Value,
    max_bytes: usize,
) -> Result<(), String> {
    let bytes = serde_json::to_vec(value)
        .map_err(|e| format!("Unable to serialize scheduled data: {e}"))?;
    if bytes.len() > max_bytes {
        return Err(format!(
            "Scheduled data exceeds the {max_bytes}-byte safety limit."
        ));
    }
    let directory = path
        .parent()
        .ok_or_else(|| "Scheduled data path has no parent directory.".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|e| format!("Unable to create scheduled task directory: {e}"))?;
    crawl_storage::write_bytes_atomic(path, &bytes)
        .map_err(|error| format!("Unable to persist scheduled data: {error}"))
}

pub(super) fn read_json<T: for<'de> Deserialize<'de>>(
    path: &Path,
    max_bytes: usize,
) -> Result<Option<T>, String> {
    let bytes = match crawl_storage::read_bytes_bounded(path, max_bytes) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Unable to read scheduled data: {e}")),
    };
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|e| format!("Scheduled data is invalid: {e}"))
}

pub(super) fn now_is_due(next_run_at: &str, now: DateTime<Utc>) -> Result<bool, String> {
    let next = DateTime::parse_from_rfc3339(next_run_at)
        .map_err(|_| "Scheduled task next run must be an RFC3339 timestamp.".to_string())?
        .with_timezone(&Utc);
    Ok(next <= now + ChronoDuration::seconds(SCHEDULE_GRACE_SECONDS))
}

pub(super) fn append_execution(
    task: &mut ScheduledTaskManifest,
    execution: &ScheduledTaskExecution,
) {
    task.run_history.push(execution.clone());
    if task.run_history.len() > 20 {
        let remove = task.run_history.len() - 20;
        task.run_history.drain(0..remove);
    }
}

pub(super) fn finalize_task(
    task: &mut ScheduledTaskManifest,
    execution: ScheduledTaskExecution,
    succeeded: bool,
) -> Result<String, String> {
    let completed_at = DateTime::parse_from_rfc3339(&execution.completed_at)
        .map_err(|_| "Scheduled task completion time must be an RFC3339 timestamp.")?
        .with_timezone(&Utc);
    let next_run_at =
        (completed_at + ChronoDuration::hours(i64::from(task.interval_hours))).to_rfc3339();
    task.status = if task.enabled {
        if succeeded {
            "completed"
        } else {
            "failed"
        }
    } else {
        "paused"
    }
    .into();
    task.last_run_at = Some(execution.completed_at.clone());
    task.next_run_at = next_run_at.clone();
    task.last_error = execution.error.clone();
    append_execution(task, &execution);
    Ok(next_run_at)
}
