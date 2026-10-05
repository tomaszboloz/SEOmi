use super::current_state::finish_if_stopped_or_changed;
use super::*;

/// Execute one stale queue run. The OS scheduler supplies only opaque IDs;
/// all URLs and state are loaded from the project-scoped native snapshot.
pub(super) async fn run_audit_queue_with<R, F, Fut>(
    app: AppHandle<R>,
    project_id: String,
    run_id: String,
    inspect: F,
    retire: impl Fn(String, String) + Send + Sync + 'static,
) -> Result<(), String>
where
    R: tauri::Runtime,
    F: Fn(String, Option<String>) -> Fut,
    Fut: std::future::Future<Output = Result<crate::models::audit_data::PageAuditData, String>>,
{
    if !valid_identifier(&project_id) || !valid_identifier(&run_id) {
        return Err("Invalid project or queue run identifier.".into());
    }
    let state = audit_queue::read_queue_state(&app, &project_id)?;
    let Some(raw_snapshot) = state.snapshot else {
        return Ok(());
    };
    let mut snapshot = parse_snapshot(raw_snapshot.clone())?;
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

    let owner = QueueOwner {
        app,
        project_id,
        run_id,
        generation: state.generation,
        retire: Box::new(retire),
    };
    let started_at = Utc::now();
    run.status = "running".into();
    run.updated_at = started_at.to_rfc3339();
    run.stop_requested = false;
    snapshot.run = Some(run.clone());
    if !owner.update(&raw_snapshot, || queue_value(&snapshot))? {
        return Ok(());
    }

    let mut first_error: Option<String> = None;
    for item_index in 0..snapshot.items.len() {
        if finish_if_stopped_or_changed(&owner, &snapshot, &first_error)? {
            return Ok(());
        }
        if !matches!(
            snapshot.items[item_index].status.as_str(),
            "queued" | "running" | "interrupted" | "failed"
        ) {
            continue;
        }

        if !process_queue_item(
            &owner,
            &mut snapshot,
            &mut run,
            item_index,
            &mut first_error,
            &inspect,
        )
        .await?
        {
            finish_if_stopped_or_changed(&owner, &snapshot, &first_error)?;
            return Ok(());
        }
    }

    super::finish::finish_run(owner, snapshot, run, first_error, started_at)
}
