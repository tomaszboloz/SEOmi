use super::lock::queue_value;
use super::models::{QueueRun, QueueSnapshot};
use crate::commands::{audit_queue, scheduler, seo_audit};
use chrono::Utc;
use serde_json::json;
use tauri::AppHandle;

pub(super) fn handle_stop_requested(
    app: &AppHandle,
    project_id: &str,
    run_id: &str,
    mut snapshot: QueueSnapshot,
    mut run: QueueRun,
    first_error: &Option<String>,
) -> Result<(), String> {
    let stopped_at = Utc::now().to_rfc3339();
    for item in &mut snapshot.items {
        if item.status == "running" {
            item.status = "interrupted".into();
            item.updated_at = Some(stopped_at.clone());
        }
    }
    run.status = "stopped".into();
    run.active_item_id = None;
    run.stop_requested = true;
    run.updated_at = stopped_at.clone();
    snapshot.run = Some(run.clone());
    audit_queue::write_queue_snapshot(app, project_id, &queue_value(&snapshot)?)?;
    let execution = json!({
        "projectId": project_id,
        "runId": run_id,
        "completedAt": stopped_at,
        "succeeded": first_error.is_none(),
        "stopped": true,
        "error": first_error,
    });
    audit_queue::write_queue_execution(app, project_id, &run.id, &execution)?;
    let _ = scheduler::unregister_audit_queue_wakeup(project_id.to_string(), run.id);
    Ok(())
}

pub(super) async fn process_queue_item(
    app: &AppHandle,
    project_id: &str,
    run_id: &str,
    snapshot: &mut QueueSnapshot,
    run: &mut QueueRun,
    item_index: usize,
    first_error: &mut Option<String>,
) -> Result<(), String> {
    let item_id = snapshot.items[item_index].id.clone();
    let url = snapshot.items[item_index].url.clone();
    let now = Utc::now().to_rfc3339();
    snapshot.items[item_index].status = "running".into();
    snapshot.items[item_index].attempts =
        Some(snapshot.items[item_index].attempts.unwrap_or(0) + 1);
    snapshot.items[item_index].updated_at = Some(now.clone());
    snapshot.items[item_index].error = None;
    run.active_item_id = Some(item_id.clone());
    run.updated_at = now;
    snapshot.run = Some(run.clone());
    audit_queue::write_queue_snapshot(app, project_id, &queue_value(snapshot)?)?;

    match seo_audit::inspect_url_headless(&url, run.user_agent.as_deref(), 15).await {
        Ok(audit) => {
            let result = json!({
                "runId": run_id,
                "itemId": item_id,
                "audit": audit,
            });
            if let Err(error) =
                audit_queue::write_queue_result(app, project_id, run_id, &item_id, &result)
            {
                first_error.get_or_insert(error.clone());
                snapshot.items[item_index].status = "failed".into();
                snapshot.items[item_index].error = Some(error);
            } else {
                snapshot.items[item_index].status = "completed".into();
                snapshot.items[item_index].completed_at = Some(Utc::now().to_rfc3339());
                snapshot.items[item_index].error = None;
            }
        }
        Err(error) => {
            first_error.get_or_insert(error.clone());
            snapshot.items[item_index].status = "failed".into();
            snapshot.items[item_index].error = Some(error.chars().take(500).collect());
        }
    }
    snapshot.items[item_index].updated_at = Some(Utc::now().to_rfc3339());
    run.active_item_id = None;
    run.updated_at = Utc::now().to_rfc3339();
    run.last_error = first_error.clone();
    snapshot.run = Some(run.clone());
    audit_queue::write_queue_snapshot(app, project_id, &queue_value(snapshot)?)?;
    Ok(())
}
