use super::{paths::write_atomic, queue_path, read_queue_snapshot};
use crate::commands::crawl_storage;
use crate::utils::file_lock::{lock_file, FileLock};
use serde_json::Value;
use std::fs;
use tauri::{AppHandle, Runtime};

pub(crate) struct QueueState {
    pub(crate) snapshot: Option<Value>,
    pub(crate) generation: Option<String>,
}

fn generation_path<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<std::path::PathBuf, String> {
    Ok(crawl_storage::project_directory(app, project_id)?.join("audit_queue_generation"))
}

pub(super) fn renew_generation<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<(), String> {
    crawl_storage::write_bytes_atomic(
        &generation_path(app, project_id)?,
        uuid::Uuid::new_v4().to_string().as_bytes(),
    )
    .map_err(|error| format!("Unable to persist audit queue generation: {error}"))
}

fn generation<R: Runtime>(app: &AppHandle<R>, project_id: &str) -> Result<Option<String>, String> {
    match crawl_storage::read_bytes_bounded(&generation_path(app, project_id)?, 128) {
        Ok(bytes) => String::from_utf8(bytes)
            .map(Some)
            .map_err(|_| "Saved audit queue generation is invalid.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Unable to read audit queue generation: {error}")),
    }
}

pub(crate) fn read_queue_state<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<QueueState, String> {
    let _lock = lock_queue(app, project_id)?;
    Ok(QueueState {
        snapshot: read_queue_snapshot(app, project_id)?,
        generation: generation(app, project_id)?,
    })
}

pub(super) fn lock_queue<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<FileLock, String> {
    let directory = crawl_storage::project_directory(app, project_id)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create audit queue directory: {error}"))?;
    // A separate stable inode serializes short snapshot/handoff mutations across
    // foreground and headless processes. Never hold this lock over network I/O.
    lock_file(&directory.join("audit_queue_mutation.lock"))
        .map_err(|error| format!("Unable to lock audit queue mutation: {error}"))
}

pub(super) fn write_snapshot_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    snapshot: &Value,
) -> Result<(), String> {
    if !snapshot.is_object() {
        return Err("Audit queue storage expects a JSON object.".into());
    }
    write_atomic(&queue_path(app, project_id)?, snapshot)
}

/// Publish only while the exact durable state read by the worker still owns
/// this operation. An absent or edited queue invalidates the old operation.
pub(crate) fn update_queue_if_current<R: Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
    expected: (&Value, Option<&str>),
    update: impl FnOnce() -> Result<Value, String>,
) -> Result<bool, String> {
    let _lock = lock_queue(app, project_id)?;
    if read_queue_snapshot(app, project_id)?.as_ref() != Some(expected.0)
        || generation(app, project_id)?.as_deref() != expected.1
    {
        return Ok(false);
    }
    let next = update()?;
    write_snapshot_unlocked(app, project_id, &next)?;
    Ok(true)
}
