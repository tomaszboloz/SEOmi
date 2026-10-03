use super::models::{QueueItem, QueueRun, QueueSnapshot};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde_json::Value;
use std::fs::{self, File, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

pub(super) const QUEUE_STALE_AFTER: ChronoDuration = ChronoDuration::minutes(5);
pub(super) const LOCK_STALE_AFTER: Duration = Duration::from_secs(2 * 60 * 60);

pub(super) struct QueueLock {
    _file: File,
    path: PathBuf,
}

impl Drop for QueueLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

pub(super) fn acquire_lock(path: &Path) -> Result<Option<QueueLock>, String> {
    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(file) => Ok(Some(QueueLock {
            _file: file,
            path: path.to_path_buf(),
        })),
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            let stale = fs::metadata(path)
                .and_then(|metadata| metadata.modified())
                .ok()
                .and_then(|modified| SystemTime::now().duration_since(modified).ok())
                .is_some_and(|age| age > LOCK_STALE_AFTER);
            if stale {
                let _ = fs::remove_file(path);
                return acquire_lock(path);
            }
            Ok(None)
        }
        Err(error) => Err(format!("Unable to acquire audit queue lock: {error}")),
    }
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
