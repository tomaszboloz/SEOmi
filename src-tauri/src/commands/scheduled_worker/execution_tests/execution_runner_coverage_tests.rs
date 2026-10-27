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
async fn disabled_task_unregisters_and_returns_ok_without_execution() {
    let app = fixture();
    let mut disabled = task("page-audit");
    disabled.enabled = false;
    store(&app, &disabled);
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();

    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("disabled task must not execute") },
        |_, _, _, _| panic!("disabled task must not register"),
        move |project, schedule| {
            assert_eq!(
                (project.as_str(), schedule.as_str()),
                ("project-1", "schedule-1")
            );
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await;

    assert!(result.is_ok());
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn task_not_due_returns_ok_without_executing_or_scheduling() {
    let app = fixture();
    let mut future_task = task("page-audit");
    future_task.next_run_at = "2099-01-01T00:00:00Z".into();
    store(&app, &future_task);

    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("future task must not execute") },
        |_, _, _, _| panic!("future task must not register"),
        |_, _| panic!("future task must not unregister"),
    )
    .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn task_removed_while_running_unregisters_and_returns_error() {
    let app = fixture();
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    store(&app, &task("page-audit"));
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();

    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            std::fs::remove_file(&path).unwrap();
            async { Ok(Value::Null) }
        },
        |_, _, _, _| panic!("removed task must not register"),
        move |project, schedule| {
            assert_eq!(
                (project.as_str(), schedule.as_str()),
                ("project-1", "schedule-1")
            );
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await;

    assert_eq!(
        result.unwrap_err(),
        "Scheduled task manifest was removed while it was running."
    );
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn task_schedule_id_mismatch_after_running_returns_error() {
    let app = fixture();
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    store(&app, &task("page-audit"));

    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let mut modified = task("page-audit");
            modified.schedule_id = "schedule-different".into();
            write_json_atomic(
                &path,
                &serde_json::to_value(modified).unwrap(),
                MAX_EXECUTION_BYTES,
            )
            .unwrap();
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
}
