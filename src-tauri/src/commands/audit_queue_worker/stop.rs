use super::lock::queue_value;
use super::models::{QueueRun, QueueSnapshot};
use super::owner::QueueOwner;
use crate::commands::audit_queue;
use chrono::Utc;
use serde_json::json;
use serde_json::Value;

pub(super) fn handle_stop_requested<R: tauri::Runtime>(
    owner: &QueueOwner<R>,
    expected: (&Value, Option<&str>),
    mut snapshot: QueueSnapshot,
    mut run: QueueRun,
    first_error: &Option<String>,
) -> Result<(), String> {
    let app = &owner.app;
    let project_id = owner.project_id.as_str();
    let run_id = owner.run_id.as_str();
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
    let execution = json!({
        "projectId": project_id,
        "runId": run_id,
        "completedAt": stopped_at,
        "succeeded": first_error.is_none(),
        "stopped": true,
        "error": first_error,
    });
    let published = audit_queue::update_queue_if_current(app, project_id, expected, || {
        audit_queue::write_queue_execution(app, project_id, &run.id, &execution)?;
        queue_value(&snapshot)
    })?;
    if published {
        (owner.retire)(project_id.to_string(), run.id);
    }
    Ok(())
}
