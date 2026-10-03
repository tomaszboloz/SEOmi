use std::fs::{self, File, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const STALE_LOCK_AFTER: Duration = Duration::from_secs(2 * 60 * 60);

pub(super) struct ScheduledLock {
    pub(super) _file: File,
    pub(super) path: PathBuf,
}

impl Drop for ScheduledLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

pub(super) fn acquire_scheduled_lock(path: &Path) -> Result<Option<ScheduledLock>, String> {
    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(file) => Ok(Some(ScheduledLock {
            _file: file,
            path: path.to_path_buf(),
        })),
        Err(e) if e.kind() == ErrorKind::AlreadyExists => {
            let stale = fs::metadata(path)
                .and_then(|m| m.modified())
                .ok()
                .and_then(|m| SystemTime::now().duration_since(m).ok())
                .is_some_and(|age| age > STALE_LOCK_AFTER);
            if stale {
                let _ = fs::remove_file(path);
                return acquire_scheduled_lock(path);
            }
            Ok(None)
        }
        Err(e) => Err(format!("Unable to acquire scheduled task lock: {e}")),
    }
}
