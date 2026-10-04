//! Headless execution for a persisted CSV/page-audit queue.
//!
//! The foreground queue remains the source of truth for user-visible state.
//! When the desktop process is closed, the OS wake-up starts this worker. It
//! resumes only a stale run, updates the durable queue after every URL, and
//! stores each successful page audit as an individually acknowledgeable
//! result so a large queue cannot be lost in one oversized handoff file.

use super::{audit_queue, crawl_storage, scheduler};
use chrono::Utc;
use serde_json::json;
use std::fs;
use tauri::AppHandle;

mod item_processor;
mod lock;
mod models;
#[cfg(test)]
mod tests;

#[cfg(test)]
mod model_tests;

#[cfg(test)]
mod state_tests;

use item_processor::{handle_stop_requested, process_queue_item};
use lock::*;
use models::*;

/// Execute one stale queue run. The OS scheduler supplies only opaque IDs;
/// all URLs and state are loaded from the project-scoped native snapshot.
pub async fn run_audit_queue(
    app: AppHandle,
    project_id: String,
    run_id: String,
) -> Result<(), String> {
    if !valid_identifier(&project_id) || !valid_identifier(&run_id) {
        return Err("Invalid project or queue run identifier.".into());
    }
    let Some(raw_snapshot) = audit_queue::read_queue_snapshot(&app, &project_id)? else {
        return Ok(());
    };
    let mut snapshot = parse_snapshot(raw_snapshot)?;
    let Some(mut run) = snapshot.run.clone() else {
        return Ok(());
    };
    if run.id != run_id || matches!(run.status.as_str(), "completed" | "stopped") {
        return Ok(());
    }
    if run.stop_requested || !queue_is_stale(&run, Utc::now())? {
        return Ok(());
    }

    let project_dir = crawl_storage::project_directory(&app, &project_id)?;
    fs::create_dir_all(&project_dir)
        .map_err(|error| format!("Unable to create audit queue directory: {error}"))?;
    let lock_path = project_dir.join(format!("audit_queue_execution_{run_id}.lock"));
    let Some(_lock) = acquire_lock(&lock_path)? else {
        return Ok(());
    };

    let started_at = Utc::now();
    run.status = "running".into();
    run.updated_at = started_at.to_rfc3339();
    run.stop_requested = false;
    snapshot.run = Some(run.clone());
    audit_queue::write_queue_snapshot(&app, &project_id, &queue_value(&snapshot)?)?;

    let mut first_error: Option<String> = None;
    for item_index in 0..snapshot.items.len() {
        if let Some(raw_snapshot) = audit_queue::read_queue_snapshot(&app, &project_id)? {
            let current_snapshot = parse_snapshot(raw_snapshot)?;
            if stop_requested_for_run(&current_snapshot, &run_id) {
                return handle_stop_requested(
                    &app,
                    &project_id,
                    &run_id,
                    current_snapshot,
                    run,
                    &first_error,
                );
            }
        }
        if !matches!(
            snapshot.items[item_index].status.as_str(),
            "queued" | "running" | "interrupted" | "failed"
        ) {
            continue;
        }

        process_queue_item(
            &app,
            &project_id,
            &run_id,
            &mut snapshot,
            &mut run,
            item_index,
            &mut first_error,
        )
        .await?;
    }

    let completed_at = Utc::now();
    let has_pending = queue_has_pending_items(&snapshot.items);
    run.status = if has_pending { "stopped" } else { "completed" }.into();
    run.active_item_id = None;
    run.updated_at = completed_at.to_rfc3339();
    run.last_error = first_error.clone();
    snapshot.run = Some(run.clone());
    audit_queue::write_queue_snapshot(&app, &project_id, &queue_value(&snapshot)?)?;
    let execution = json!({
        "projectId": project_id,
        "runId": run_id,
        "startedAt": started_at.to_rfc3339(),
        "completedAt": completed_at.to_rfc3339(),
        "succeeded": first_error.is_none(),
        "error": first_error,
    });
    audit_queue::write_queue_execution(&app, &project_id, &run.id, &execution)?;
    let _ = scheduler::unregister_audit_queue_wakeup(project_id, run.id);
    Ok(())
}

pub fn headless_launch_context() -> Option<(String, String)> {
    let args = std::env::args().collect::<Vec<_>>();
    if !args
        .iter()
        .any(|value| value == "--seomi-audit-queue-headless")
    {
        return None;
    }
    let value_after = |flag: &str| {
        args.windows(2)
            .find(|pair| pair[0] == flag)
            .map(|pair| pair[1].clone())
            .filter(|value| valid_identifier(value))
    };
    Some((
        value_after("--seomi-scheduled-project")?,
        value_after("--seomi-scheduled-id")?,
    ))
}
