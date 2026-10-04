use crate::utils::file_lock::{acquire_file_lock, FileLock};
use std::path::Path;

#[cfg(test)]
#[path = "lock_tests.rs"]
mod tests;

pub(super) fn acquire_scheduled_lock(path: &Path) -> Result<Option<FileLock>, String> {
    acquire_file_lock(path)
        .map_err(|error| format!("Unable to acquire scheduled task lock: {error}"))
}
