use super::*;
use std::{
    fs,
    sync::{Arc, Barrier},
};

fn directory() -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-native-lock-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn lock_is_exclusive_released_on_drop_and_preserves_existing_file_bytes() {
    let directory = directory();
    let path = directory.join("task.lock");
    fs::write(&path, b"previous lock file").unwrap();
    let first = acquire_file_lock(&path).unwrap().unwrap();
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(first);
    assert_eq!(fs::read(&path).unwrap(), b"previous lock file");
    let next = acquire_file_lock(&path).unwrap().unwrap();
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(next);
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn concurrent_contenders_have_exactly_one_owner_until_barrier_release() {
    let directory = directory();
    let path = directory.join("task.lock");
    let start = Arc::new(Barrier::new(16));
    let finish = Arc::new(Barrier::new(16));
    let tasks: Vec<_> = (0..16)
        .map(|_| {
            let (path, start, finish) = (path.clone(), start.clone(), finish.clone());
            std::thread::spawn(move || {
                start.wait();
                let lock = acquire_file_lock(&path).unwrap();
                let acquired = lock.is_some();
                finish.wait();
                drop(lock);
                acquired
            })
        })
        .collect();
    assert_eq!(
        tasks
            .into_iter()
            .map(|task| usize::from(task.join().unwrap()))
            .sum::<usize>(),
        1
    );
    assert!(acquire_file_lock(&path).unwrap().is_some());
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn lock_creation_failures_are_errors_not_busy_or_recursive_retries() {
    let directory = directory();
    assert!(acquire_file_lock(&directory.join("missing/task.lock")).is_err());
    assert!(acquire_file_lock(&directory).is_err());
    assert!(lock_file(&directory.join("missing/task.lock")).is_err());
    assert!(lock_file(&directory).is_err());
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn blocking_writer_waits_for_owner_release_and_keeps_the_same_lock_file() {
    let directory = directory();
    let path = directory.join("task.lock");
    let owner = lock_file(&path).unwrap();
    let (started_sender, started) = std::sync::mpsc::channel();
    let (acquired_sender, acquired) = std::sync::mpsc::channel();
    let worker_path = path.clone();
    let worker = std::thread::spawn(move || {
        started_sender.send(()).unwrap();
        let _owner = lock_file(&worker_path).unwrap();
        acquired_sender.send(()).unwrap();
    });
    started.recv().unwrap();
    assert!(acquired
        .recv_timeout(std::time::Duration::from_millis(30))
        .is_err());
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(owner);
    acquired
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    worker.join().unwrap();
    assert!(path.is_file());
    assert!(acquire_file_lock(&path).unwrap().is_some());
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn owner_drop_releases_lock_even_when_open_description_has_another_handle() {
    let directory = directory();
    let path = directory.join("task.lock");
    let owner = lock_file(&path).unwrap();
    let inherited_description = owner._file.try_clone().unwrap();
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(owner);
    let next = acquire_file_lock(&path)
        .unwrap()
        .expect("explicit owner release");
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(inherited_description);
    assert!(acquire_file_lock(&path).unwrap().is_none());
    drop(next);
    fs::remove_dir_all(directory).unwrap();
}
