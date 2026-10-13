use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(super) fn entry_path(
    entry: io::Result<fs::DirEntry>,
    context: &str,
) -> Result<PathBuf, String> {
    entry
        .map(|entry| entry.path())
        .map_err(|error| format!("{context}: {error}"))
}

/// True when the final path component is valid UTF-8 and satisfies `matches`.
pub(super) fn name_matches(path: &Path, matches: impl FnOnce(&str) -> bool) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(matches)
}

pub(super) fn remove_handoff_files(directory: &Path) -> Result<(), String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Unable to inspect audit queue files: {error}")),
    };
    for entry in entries {
        let path = entry_path(entry, "Unable to inspect audit queue file")?;
        if name_matches(&path, is_queue_handoff_file) {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

pub(super) fn is_queue_handoff_file(name: &str) -> bool {
    (name.starts_with("audit_queue_execution_") || name.starts_with("audit_queue_result_"))
        && name.ends_with(".json")
}

#[cfg(test)]
#[path = "cleanup_helper_tests.rs"]
mod helper_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_cleanup_preserves_os_ownership_and_destination_write_locks() {
        for name in [
            "audit_queue_execution_run.lock",
            "audit_queue_execution_run.json.write.lock",
            "audit_queue_result_run_item.json.write.lock",
        ] {
            assert!(!is_queue_handoff_file(name), "must preserve {name}");
        }
    }

    #[test]
    fn queue_cleanup_removes_only_owned_json_handoffs() {
        for name in [
            "audit_queue_execution_run.json",
            "audit_queue_result_run_item.json",
        ] {
            assert!(is_queue_handoff_file(name));
        }
        for name in [
            "audit_queue.json",
            "scheduled_execution_run.json",
            "audit_queue_result_run.json.abc.tmp",
            "audit_queue_execution_run.json.bak",
            "audit_queue_execution_",
        ] {
            assert!(!is_queue_handoff_file(name), "must preserve {name}");
        }
    }

    #[test]
    fn cleanup_keeps_lock_inode_exclusive_during_live_worker_ownership() {
        use std::fs;
        let directory =
            std::env::temp_dir().join(format!("seomi-cleanup-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        let lock_path = directory.join("audit_queue_execution_run.lock");
        let owner = crate::utils::file_lock::acquire_file_lock(&lock_path)
            .unwrap()
            .unwrap();
        let json_path = directory.join("audit_queue_execution_run.json");
        fs::write(&json_path, b"{}").unwrap();
        for entry in fs::read_dir(&directory).unwrap() {
            let path = entry.unwrap().path();
            if is_queue_handoff_file(path.file_name().unwrap().to_str().unwrap()) {
                fs::remove_file(path).unwrap();
            }
        }
        assert!(!json_path.exists());
        assert!(lock_path.is_file());
        assert!(crate::utils::file_lock::acquire_file_lock(&lock_path)
            .unwrap()
            .is_none());
        drop(owner);
        assert!(crate::utils::file_lock::acquire_file_lock(&lock_path)
            .unwrap()
            .is_some());
        fs::remove_dir_all(directory).unwrap();
    }
}
