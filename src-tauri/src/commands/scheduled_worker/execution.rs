use super::lock::acquire_scheduled_lock;
use super::models::*;
use super::storage::*;
use crate::commands::{crawl_storage, scheduler, seo_audit, site_crawler};
use chrono::Utc;
use serde_json::Value;
use std::fs;
use tauri::AppHandle;

async fn execute_task(
    app: &AppHandle,
    project_id: &str,
    task: &ScheduledTaskManifest,
) -> Result<Value, String> {
    match task.task_type.as_str() {
        "page-audit" => {
            let result = seo_audit::inspect_url_headless(&task.url, None, 15).await?;
            serde_json::to_value(result).map_err(|e| format!("Unable to serialize page audit: {e}"))
        }
        "site-crawl" => {
            let config = task.crawl_config.clone();
            if config
                .as_ref()
                .is_some_and(|v| v.crawl_mode == "browser-rendered")
            {
                return Err("Scheduled browser-rendered crawls require an interactive desktop WebView; use HTTP mode for headless execution.".into());
            }
            let control = site_crawler::CrawlControl::new();
            let run_id = format!("scheduled-{}", task.schedule_id);
            let result = site_crawler::crawl_site_with_control(
                app.clone(),
                &control,
                task.url.clone(),
                Some(task.crawl_limit.unwrap_or(25)),
                config.as_ref().and_then(|v| v.user_agent.clone()),
                Some(run_id),
                Some(project_id.to_string()),
                config,
            )
            .await?;
            serde_json::to_value(result).map_err(|e| format!("Unable to serialize site crawl: {e}"))
        }
        _ => Err("Unsupported scheduled task type.".into()),
    }
}

pub async fn run_scheduled_task(
    app: AppHandle,
    project_id: String,
    schedule_id: String,
) -> Result<(), String> {
    let path = task_path(&app, &project_id, &schedule_id)?;
    let Some(mut task) = read_json::<ScheduledTaskManifest>(&path, MAX_EXECUTION_BYTES)? else {
        let _ = scheduler::unregister_audit_wakeup(project_id, schedule_id);
        return Err("Scheduled task manifest was not found.".into());
    };
    validate_manifest(&project_id, &task)?;
    if !task.enabled {
        let _ = scheduler::unregister_audit_wakeup(project_id, schedule_id);
        return Ok(());
    }
    if !now_is_due(&task.next_run_at, Utc::now())? {
        return Ok(());
    }
    let project_dir = crawl_storage::project_directory(&app, &project_id)?;
    let lock_path = project_dir.join(format!("scheduled_execution_{schedule_id}.lock"));
    fs::create_dir_all(&project_dir)
        .map_err(|e| format!("Unable to create scheduled task directory: {e}"))?;
    let Some(_lock_guard) = acquire_scheduled_lock(&lock_path)? else {
        return Ok(());
    };

    let started_at = Utc::now();
    task.status = "running".into();
    task.last_started_at = Some(started_at.to_rfc3339());
    task.last_error = None;
    write_json_atomic(
        &path,
        &serde_json::to_value(&task).map_err(|e| e.to_string())?,
        MAX_EXECUTION_BYTES,
    )?;

    let outcome = execute_task(&app, &project_id, &task).await;
    let completed_at = Utc::now();
    let succeeded = outcome.is_ok();
    let error = outcome
        .as_ref()
        .err()
        .map(|v| v.chars().take(500).collect::<String>());
    let execution = ScheduledTaskExecution {
        started_at: started_at.to_rfc3339(),
        completed_at: completed_at.to_rfc3339(),
        succeeded,
        error: error.clone(),
    };
    let Some(mut latest_task) = read_json::<ScheduledTaskManifest>(&path, MAX_EXECUTION_BYTES)?
    else {
        let _ = scheduler::unregister_audit_wakeup(project_id, schedule_id);
        return Err("Scheduled task manifest was removed while it was running.".into());
    };
    validate_manifest(&project_id, &latest_task)?;
    let next_run_at = finalize_task(&mut latest_task, execution.clone(), succeeded)?;
    write_json_atomic(
        &path,
        &serde_json::to_value(&latest_task).map_err(|v| v.to_string())?,
        MAX_EXECUTION_BYTES,
    )?;

    let scheduler_error = if latest_task.enabled {
        scheduler::register_audit_wakeup(
            project_id.clone(),
            schedule_id.clone(),
            next_run_at.clone(),
            latest_task.interval_hours,
        )
        .err()
    } else {
        scheduler::unregister_audit_wakeup(project_id.clone(), schedule_id.clone()).err()
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
        &serde_json::to_value(handoff).map_err(|v| v.to_string())?,
        MAX_EXECUTION_BYTES,
    )
}
