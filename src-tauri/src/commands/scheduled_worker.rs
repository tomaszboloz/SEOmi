mod execution;
mod launch;
mod lock;
mod models;
mod storage;

#[cfg(test)]
mod tests;

pub use execution::run_scheduled_task;
pub use launch::headless_launch_context;
pub use models::{ScheduledExecutionHandoff, ScheduledTaskExecution, ScheduledTaskManifest};

use crate::commands::crawl_storage;
use models::*;
use serde_json::Value;
use std::fs;
use std::io::ErrorKind;
use storage::*;
use tauri::AppHandle;

#[tauri::command]
pub fn save_scheduled_task(
    app: AppHandle,
    project_id: String,
    task: ScheduledTaskManifest,
) -> Result<(), String> {
    validate_manifest(&project_id, &task)?;
    let path = task_path(&app, &project_id, &task.schedule_id)?;
    write_json_atomic(
        &path,
        &serde_json::to_value(task).map_err(|error| error.to_string())?,
        MAX_EXECUTION_BYTES,
    )
}

#[tauri::command]
pub fn delete_scheduled_task(
    app: AppHandle,
    project_id: String,
    schedule_id: String,
) -> Result<(), String> {
    let task = task_path(&app, &project_id, &schedule_id)?;
    let execution = execution_path(&app, &project_id, &schedule_id)?;
    let result = result_path(&app, &project_id, &schedule_id)?;
    for path in [task, execution, result] {
        if let Err(error) = fs::remove_file(path) {
            if error.kind() != ErrorKind::NotFound {
                return Err(format!("Unable to remove scheduled task data: {error}"));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn load_scheduled_execution(
    app: AppHandle,
    project_id: String,
    schedule_id: String,
) -> Result<Option<ScheduledExecutionHandoff>, String> {
    let metadata_path = execution_path(&app, &project_id, &schedule_id)?;
    let Some(mut handoff) =
        read_json::<ScheduledExecutionHandoff>(&metadata_path, MAX_EXECUTION_BYTES)?
    else {
        return Ok(None);
    };
    let result_file = result_path(&app, &project_id, &schedule_id)?;
    if handoff.succeeded {
        handoff.result = read_json::<Value>(&result_file, MAX_RESULT_BYTES)?;
    }
    Ok(Some(handoff))
}

#[tauri::command]
pub fn list_scheduled_executions(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<ScheduledExecutionHandoff>, String> {
    if !valid_identifier(&project_id) {
        return Err("Invalid project identifier.".into());
    }
    let directory = crawl_storage::project_directory(&app, &project_id)?;
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Unable to list scheduled executions: {error}")),
    };
    let mut handoffs = Vec::new();
    for entry in entries {
        let path = entry
            .map_err(|error| format!("Unable to read scheduled execution entry: {error}"))?
            .path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.starts_with("scheduled_execution_") || !name.ends_with(".json") {
            continue;
        }
        if let Some(mut handoff) =
            read_json::<ScheduledExecutionHandoff>(&path, MAX_EXECUTION_BYTES)?
        {
            let result_file = result_path(&app, &project_id, &handoff.schedule_id)?;
            if handoff.succeeded {
                handoff.result = read_json::<Value>(&result_file, MAX_RESULT_BYTES)?;
            }
            handoffs.push(handoff);
        }
    }
    handoffs.sort_by(|left, right| right.completed_at.cmp(&left.completed_at));
    handoffs.truncate(20);
    Ok(handoffs)
}

#[tauri::command]
pub fn acknowledge_scheduled_execution(
    app: AppHandle,
    project_id: String,
    schedule_id: String,
) -> Result<(), String> {
    let metadata_path = execution_path(&app, &project_id, &schedule_id)?;
    let result_file = result_path(&app, &project_id, &schedule_id)?;
    for path in [metadata_path, result_file] {
        if let Err(error) = fs::remove_file(path) {
            if error.kind() != ErrorKind::NotFound {
                return Err(format!(
                    "Unable to acknowledge scheduled execution: {error}"
                ));
            }
        }
    }
    Ok(())
}
