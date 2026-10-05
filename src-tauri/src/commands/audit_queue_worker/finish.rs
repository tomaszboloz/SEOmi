use super::current_state::finish_if_stopped_or_changed;
use super::*;

pub(super) fn finish_run<R: tauri::Runtime>(
    owner: QueueOwner<R>,
    mut snapshot: QueueSnapshot,
    mut run: QueueRun,
    first_error: Option<String>,
    started_at: chrono::DateTime<Utc>,
) -> Result<(), String> {
    let expected = queue_value(&snapshot)?;
    let completed_at = Utc::now();
    let has_pending = queue_has_pending_items(&snapshot.items);
    run.status = if has_pending { "stopped" } else { "completed" }.into();
    run.active_item_id = None;
    run.updated_at = completed_at.to_rfc3339();
    run.last_error = first_error.clone();
    snapshot.run = Some(run.clone());
    let execution = json!({
        "projectId": owner.project_id,
        "runId": owner.run_id,
        "startedAt": started_at.to_rfc3339(),
        "completedAt": completed_at.to_rfc3339(),
        "succeeded": first_error.is_none(),
        "error": first_error,
    });
    let published = owner.update(&expected, || {
        audit_queue::write_queue_execution(&owner.app, &owner.project_id, &run.id, &execution)?;
        queue_value(&snapshot)
    })?;
    if published {
        (owner.retire)(owner.project_id, run.id);
    } else {
        finish_if_stopped_or_changed(&owner, &snapshot, &first_error)?;
    }
    Ok(())
}
