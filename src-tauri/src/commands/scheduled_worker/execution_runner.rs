use super::super::{lock::acquire_scheduled_lock, models::*, storage::*};
use crate::commands::crawl_storage;
use chrono::Utc;
use serde_json::Value;
use std::{fs, future::Future};
use tauri::{AppHandle, Runtime};

pub(super) async fn run_scheduled_task_with<R, Execute, Register, Unregister, TaskFuture>(
    app: AppHandle<R>,
    project_id: String,
    schedule_id: String,
    execute: Execute,
    register: Register,
    unregister: Unregister,
) -> Result<(), String>
where
    R: Runtime,
    Execute: Fn(ScheduledTaskManifest) -> TaskFuture,
    TaskFuture: Future<Output = Result<Value, String>>,
    Register: Fn(String, String, String, u32) -> Result<(), String>,
    Unregister: Fn(String, String) -> Result<(), String>,
{
    let path = task_path(&app, &project_id, &schedule_id)?;
    let Some(mut task) = read_json::<ScheduledTaskManifest>(&path, MAX_EXECUTION_BYTES)? else {
        let _ = unregister(project_id, schedule_id);
        return Err("Scheduled task manifest was not found.".into());
    };
    validate_manifest(&project_id, &task)?;
    if task.schedule_id != schedule_id {
        return Err("Scheduled task manifest does not match requested schedule.".into());
    }
    if !task.enabled {
        let _ = unregister(project_id, schedule_id);
        return Ok(());
    }
    if !now_is_due(&task.next_run_at, Utc::now())? {
        return Ok(());
    }
    let project_dir = crawl_storage::project_directory(&app, &project_id)?;
    let lock_path = project_dir.join(format!("scheduled_execution_{schedule_id}.lock"));
    fs::create_dir_all(&project_dir)
        .map_err(|error| format!("Unable to create scheduled task directory: {error}"))?;
    let Some(_lock_guard) = acquire_scheduled_lock(&lock_path)? else {
        return Ok(());
    };

    let started_at = Utc::now();
    task.status = "running".into();
    task.last_started_at = Some(started_at.to_rfc3339());
    task.last_error = None;
    write_json_atomic(
        &path,
        &serde_json::to_value(&task).map_err(|error| error.to_string())?,
        MAX_EXECUTION_BYTES,
    )?;
    let outcome = execute(task.clone()).await;
    let completed_at = Utc::now();
    let succeeded = outcome.is_ok();
    let error = outcome
        .as_ref()
        .err()
        .map(|value| value.chars().take(500).collect());
    let execution = ScheduledTaskExecution {
        started_at: started_at.to_rfc3339(),
        completed_at: completed_at.to_rfc3339(),
        succeeded,
        error: error.clone(),
    };
    let Some(mut latest_task) = read_json::<ScheduledTaskManifest>(&path, MAX_EXECUTION_BYTES)?
    else {
        let _ = unregister(project_id, schedule_id);
        return Err("Scheduled task manifest was removed while it was running.".into());
    };
    validate_manifest(&project_id, &latest_task)?;
    if latest_task.schedule_id != schedule_id {
        return Err("Scheduled task manifest does not match requested schedule.".into());
    }
    let next_run_at = finalize_task(&mut latest_task, execution.clone(), succeeded)?;
    write_json_atomic(
        &path,
        &serde_json::to_value(&latest_task).map_err(|error| error.to_string())?,
        MAX_EXECUTION_BYTES,
    )?;
    let scheduler_error = if latest_task.enabled {
        register(
            project_id.clone(),
            schedule_id.clone(),
            next_run_at.clone(),
            latest_task.interval_hours,
        )
        .err()
    } else {
        unregister(project_id.clone(), schedule_id.clone()).err()
    };
    let handoff = ScheduledExecutionHandoff {
        project_id,
        schedule_id,
        task_type: task.task_type,
        started_at: execution.started_at,
        completed_at: execution.completed_at,
        succeeded,
        next_run_at,
        error,
        scheduler_error,
        result: None,
    };
    let metadata_path = execution_path(&app, &handoff.project_id, &handoff.schedule_id)?;
    let result_path = result_path(&app, &handoff.project_id, &handoff.schedule_id)?;
    if let Ok(result) = outcome {
        write_json_atomic(&result_path, &result, MAX_RESULT_BYTES)?;
    } else {
        let _ = fs::remove_file(&result_path);
    }
    write_json_atomic(
        &metadata_path,
        &serde_json::to_value(handoff).map_err(|error| error.to_string())?,
        MAX_EXECUTION_BYTES,
    )
}
