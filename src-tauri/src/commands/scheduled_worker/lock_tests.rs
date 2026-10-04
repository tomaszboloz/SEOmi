use super::*;
use std::{
    fs::{self, OpenOptions},
    time::{Duration, SystemTime},
};

#[test]
fn live_owner_keeps_exclusive_lock_even_when_file_timestamp_is_old() {
    let directory =
        std::env::temp_dir().join(format!("seomi-scheduled-lock-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("task.lock");
    let first = acquire_scheduled_lock(&path).unwrap().unwrap();
    OpenOptions::new()
        .write(true)
        .open(&path)
        .unwrap()
        .set_times(
            fs::FileTimes::new().set_modified(SystemTime::now() - Duration::from_secs(3 * 60 * 60)),
        )
        .unwrap();
    assert!(acquire_scheduled_lock(&path).unwrap().is_none());
    drop(first);
    let next = acquire_scheduled_lock(&path).unwrap().unwrap();
    assert!(acquire_scheduled_lock(&path).unwrap().is_none());
    drop(next);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn abandoned_lock_file_does_not_delay_restart_for_two_hours() {
    let directory =
        std::env::temp_dir().join(format!("seomi-scheduled-restart-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("task.lock");
    fs::write(&path, b"legacy lock after process crash").unwrap();
    let owner = acquire_scheduled_lock(&path)
        .unwrap()
        .expect("no live OS owner");
    assert!(acquire_scheduled_lock(&path).unwrap().is_none());
    drop(owner);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn scheduled_lock_reports_invalid_parent_and_directory_paths() {
    let directory = std::env::temp_dir().join(format!("seomi-lock-error-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    for path in [directory.clone(), directory.join("missing/task.lock")] {
        assert!(acquire_scheduled_lock(&path)
            .err()
            .unwrap()
            .starts_with("Unable to acquire scheduled task lock:"));
    }
    fs::remove_dir_all(directory).unwrap();
}
