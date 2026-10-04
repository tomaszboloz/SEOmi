use super::*;
use std::{
    fs::{self, OpenOptions},
    time::{Duration, SystemTime},
};

#[test]
fn live_queue_owner_is_not_replaced_based_on_modification_time() {
    let directory = std::env::temp_dir().join(format!("seomi-queue-lock-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("queue.lock");
    let first = acquire_lock(&path).unwrap().unwrap();
    OpenOptions::new()
        .write(true)
        .open(&path)
        .unwrap()
        .set_times(
            fs::FileTimes::new().set_modified(SystemTime::now() - Duration::from_secs(3 * 60 * 60)),
        )
        .unwrap();
    assert!(acquire_lock(&path).unwrap().is_none());
    drop(first);
    let next = acquire_lock(&path).unwrap().unwrap();
    assert!(acquire_lock(&path).unwrap().is_none());
    drop(next);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn abandoned_queue_lock_can_be_reclaimed_immediately() {
    let directory =
        std::env::temp_dir().join(format!("seomi-queue-restart-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("queue.lock");
    fs::write(&path, b"legacy orphaned lock").unwrap();
    let owner = acquire_lock(&path).unwrap().expect("no live OS owner");
    assert!(acquire_lock(&path).unwrap().is_none());
    drop(owner);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn queue_lock_reports_invalid_parent_and_directory_paths() {
    let directory =
        std::env::temp_dir().join(format!("seomi-queue-lock-error-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    for path in [directory.clone(), directory.join("missing/task.lock")] {
        assert!(acquire_lock(&path)
            .err()
            .unwrap()
            .starts_with("Unable to acquire audit queue lock:"));
    }
    fs::remove_dir_all(directory).unwrap();
}
