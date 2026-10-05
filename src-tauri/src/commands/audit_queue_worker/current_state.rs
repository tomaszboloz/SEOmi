use super::*;

pub(super) fn finish_if_stopped_or_changed<R: tauri::Runtime>(
    owner: &QueueOwner<R>,
    expected: &QueueSnapshot,
    first_error: &Option<String>,
) -> Result<bool, String> {
    let state = audit_queue::read_queue_state(&owner.app, &owner.project_id)?;
    let Some(raw) = state.snapshot else {
        return Ok(true);
    };
    if raw == queue_value(expected)? && state.generation == owner.generation {
        return Ok(false);
    }
    let current = parse_snapshot(raw.clone())?;
    if stop_requested_for_run(&current, &owner.run_id) {
        let run = current.run.clone().ok_or("Saved audit queue has no run.")?;
        handle_stop_requested(
            owner,
            (&raw, state.generation.as_deref()),
            current,
            run,
            first_error,
        )?;
    }
    Ok(true)
}
