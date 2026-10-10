use super::super::super::models::{MAX_EXECUTION_BYTES, MAX_RESULT_BYTES};
use super::super::super::storage::{read_json, result_path, task_path, write_json_atomic};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, read_task, read_value, store, task};
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[tokio::test]
async fn successful_execution_persists_result_history_and_scheduler_registration() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let registrations = Arc::new(AtomicUsize::new(0));
    let seen = registrations.clone();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |value| async move { Ok(json!({"url":value.url, "pages":3})) },
        move |project, schedule, next, interval| {
            assert_eq!(
                (project, schedule),
                ("project-1".to_owned(), "schedule-1".to_owned())
            );
            assert!(!next.is_empty());
            assert_eq!(interval, 24);
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
        |_, _| Ok(()),
    )
    .await
    .unwrap();
    let current = read_task(&app, "schedule-1");
    assert_eq!(current.status, "completed");
    assert_eq!(current.run_history.len(), 1);
    assert!(current.last_run_at.is_some());
    let handoff = read_value(&app, "schedule-1");
    assert_eq!(handoff["succeeded"], true);
    assert_eq!(handoff["schedulerError"], Value::Null);
    let result = read_json::<Value>(
        &result_path(&app.handle(), "project-1", "schedule-1").unwrap(),
        MAX_RESULT_BYTES,
    )
    .unwrap()
    .unwrap();
    assert_eq!(result["pages"], 3);
    assert_eq!(registrations.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn failed_execution_bounds_error_removes_old_result_and_records_scheduler_error() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let result_path = result_path(&app.handle(), "project-1", "schedule-1").unwrap();
    std::fs::write(&result_path, b"{\"old\":true}").unwrap();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { Err::<Value, _>("x".repeat(600)) },
        |_, _, _, _| Err("scheduler down".into()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();
    let current = read_task(&app, "schedule-1");
    assert_eq!(current.status, "failed");
    assert_eq!(current.last_error.as_deref().unwrap().len(), 500);
    let handoff = read_value(&app, "schedule-1");
    assert_eq!(handoff["succeeded"], false);
    assert_eq!(handoff["error"].as_str().unwrap().len(), 500);
    assert_eq!(handoff["schedulerError"], "scheduler down");
    assert!(!result_path.exists());
}

#[tokio::test]
async fn executor_can_pause_a_task_before_final_scheduler_update() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen = unregisters.clone();
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let mut latest = task("page-audit");
            latest.enabled = false;
            latest.status = "paused".into();
            write_json_atomic(
                &path,
                &serde_json::to_value(latest).unwrap(),
                MAX_EXECUTION_BYTES,
            )
            .unwrap();
            async { Ok(json!({"paused":true})) }
        },
        |_, _, _, _| panic!("disabled task must not register"),
        move |_, _| {
            seen.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await
    .unwrap();
    assert_eq!(read_task(&app, "schedule-1").status, "paused");
    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
}
