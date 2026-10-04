use super::models::{QueueItem, QueueRun, QueueSnapshot};
use crate::utils::file_lock::{acquire_file_lock, FileLock};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde_json::Value;
use std::path::Path;

pub(super) const QUEUE_STALE_AFTER: ChronoDuration = ChronoDuration::minutes(5);

#[cfg(test)]
#[path = "lock_tests.rs"]
mod lock_tests;

pub(super) fn acquire_lock(path: &Path) -> Result<Option<FileLock>, String> {
    acquire_file_lock(path).map_err(|error| format!("Unable to acquire audit queue lock: {error}"))
}

pub(super) fn queue_is_stale(run: &QueueRun, now: DateTime<Utc>) -> Result<bool, String> {
    let updated = DateTime::parse_from_rfc3339(&run.updated_at)
        .map_err(|_| "Saved audit queue run has an invalid update timestamp.")?
        .with_timezone(&Utc);
    Ok(updated <= now - QUEUE_STALE_AFTER)
}

pub(super) fn queue_has_pending_items(items: &[QueueItem]) -> bool {
    items.iter().any(|item| {
        matches!(
            item.status.as_str(),
            "queued" | "running" | "interrupted" | "failed"
        )
    })
}

pub(super) fn stop_requested_for_run(snapshot: &QueueSnapshot, run_id: &str) -> bool {
    snapshot
        .run
        .as_ref()
        .is_some_and(|run| run.id == run_id && run.stop_requested)
}

pub(super) fn queue_value(snapshot: &QueueSnapshot) -> Result<Value, String> {
    serde_json::to_value(snapshot)
        .map_err(|error| format!("Unable to serialize audit queue: {error}"))
}
