use super::super::super::storage::task_path;
use super::super::runner::run_scheduled_task_with;
use super::{fixture, read_task, store, task};
use crate::commands::scheduled_worker::save_scheduled_task;
use serde_json::json;
use std::fs;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[tokio::test]
async fn corrupted_manifest_is_rejected_and_recovered_by_clean_save() {
    let app = fixture();
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, b"not valid json at all").unwrap();

    let err = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("must not execute corrupted manifest") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();
    assert!(err.contains("Scheduled data is invalid"));

    let valid_task = task("page-audit");
    save_scheduled_task(app.handle(), "project-1".into(), valid_task).unwrap();

    let executed = Arc::new(AtomicUsize::new(0));
    let seen = executed.clone();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            seen.fetch_add(1, Ordering::SeqCst);
            async { Ok(json!({"recovered": true})) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();
    assert_eq!(executed.load(Ordering::SeqCst), 1);
    assert_eq!(read_task(&app, "schedule-1").status, "completed");
}

#[tokio::test]
async fn invalid_manifest_fields_reject_before_execution() {
    let app = fixture();
    let mut bad_task = task("page-audit");
    bad_task.interval_hours = 10;
    store(&app, &bad_task);

    let err = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("must not execute") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();
    assert_eq!(err, "Unsupported scheduled task interval.");

    let mut url_cred_task = task("page-audit");
    url_cred_task.url = "https://user:pass@example.test/".into();
    store(&app, &url_cred_task);
    let err2 = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("must not execute") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();
    assert!(err2.contains("embedded credentials are not allowed"));
}

#[tokio::test]
async fn stale_lock_file_recovers_and_allows_subsequent_execution() {
    let app = fixture();
    let due_task = task("page-audit");
    store(&app, &due_task);

    let lock_file = task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .with_file_name("scheduled_execution_schedule-1.lock");
    fs::create_dir_all(lock_file.parent().unwrap()).unwrap();
    fs::write(&lock_file, b"stale lock content from terminated process").unwrap();

    let executed = Arc::new(AtomicUsize::new(0));
    let seen = executed.clone();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            seen.fetch_add(1, Ordering::SeqCst);
            async { Ok(json!({"stale_lock_recovered": true})) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();
    assert_eq!(executed.load(Ordering::SeqCst), 1);
    assert_eq!(read_task(&app, "schedule-1").status, "completed");
}

#[tokio::test]
async fn lock_acquisition_failure_due_to_non_directory_parent_fails_with_error() {
    let app = fixture();
    let due_task = task("page-audit");
    store(&app, &due_task);

    let lock_file = task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .with_file_name("scheduled_execution_schedule-1.lock");
    fs::create_dir_all(&lock_file).unwrap();

    let err = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("must not run when lock cannot be created") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();
    assert!(err.contains("Unable to acquire scheduled task lock"));
}
