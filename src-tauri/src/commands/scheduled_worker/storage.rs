use super::models::*;
use crate::commands::crawl_storage;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use tauri::AppHandle;

pub(super) fn task_path(
    app: &AppHandle,
    project_id: &str,
    schedule_id: &str,
) -> Result<PathBuf, String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("scheduled_task_{schedule_id}.json")))
}

pub(super) fn execution_path(
    app: &AppHandle,
    project_id: &str,
    schedule_id: &str,
) -> Result<PathBuf, String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("scheduled_execution_{schedule_id}.json")))
}

pub(super) fn result_path(
    app: &AppHandle,
    project_id: &str,
    schedule_id: &str,
) -> Result<PathBuf, String> {
    validate_project_and_schedule(project_id, schedule_id)?;
    Ok(crawl_storage::project_directory(app, project_id)?
        .join(format!("scheduled_result_{schedule_id}.json")))
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
    let temporary = path.with_extension("json.tmp");
    if let Err(e) = fs::write(&temporary, bytes) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to write scheduled data: {e}"));
    }
    if let Err(e) = crawl_storage::replace_file(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to finalize scheduled data: {e}"));
    }
    Ok(())
}

pub(super) fn read_json<T: for<'de> Deserialize<'de>>(
    path: &PathBuf,
    max_bytes: usize,
) -> Result<Option<T>, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Unable to read scheduled data: {e}")),
    };
    if bytes.len() > max_bytes {
        return Err("Scheduled data exceeds the safety limit.".into());
    }
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
