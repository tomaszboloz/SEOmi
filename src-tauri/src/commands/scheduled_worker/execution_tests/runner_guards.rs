use super::super::super::lock::acquire_scheduled_lock;
use super::super::super::models::MAX_EXECUTION_BYTES;
use super::super::super::storage::{task_path, write_json_atomic};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, store, task};
use serde_json::Value;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[tokio::test]
async fn missing_and_disabled_tasks_unregister_without_execution() {
    let app = fixture();
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();
    let error = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("executor must not run") },
        |_, _, _, _| Ok(()),
        move |_, _| {
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Scheduled task manifest was not found.");

    let app = fixture();
    let mut disabled = task("page-audit");
    disabled.enabled = false;
    disabled.status = "paused".into();
    store(&app, &disabled);
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("executor must not run") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn future_and_locked_tasks_leave_the_executor_idle() {
    let app = fixture();
    let mut future = task("page-audit");
    future.next_run_at = "2999-09-25T01:00:00Z".into();
    store(&app, &future);
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("executor must not run") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();

    let app = fixture();
    let due = task("page-audit");
    store(&app, &due);
    let lock = task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .with_file_name("scheduled_execution_schedule-1.lock");
    let _owner = acquire_scheduled_lock(&lock).unwrap().unwrap();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("executor must not run") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn removed_manifest_after_execution_is_reported_and_unregistered() {
    let app = fixture();
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    store(&app, &task("page-audit"));
    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            std::fs::remove_file(&path).unwrap();
            async { Ok(Value::Null) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await;
    assert_eq!(
        result.unwrap_err(),
        "Scheduled task manifest was removed while it was running."
    );
}

#[tokio::test]
async fn manifest_schedule_id_must_match_the_requested_path_before_execution() {
    let app = fixture();
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    let mut mismatched = task("page-audit");
    mismatched.schedule_id = "schedule-2".into();
    write_json_atomic(
        &path,
        &serde_json::to_value(mismatched).unwrap(),
        MAX_EXECUTION_BYTES,
    )
    .unwrap();
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            seen.fetch_add(1, Ordering::SeqCst);
            async { Ok(Value::Null) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await;
    assert_eq!(
        result.unwrap_err(),
        "Scheduled task manifest does not match requested schedule."
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}
