use super::super::super::lock::acquire_scheduled_lock;
use super::super::super::storage::{finalize_task, now_is_due, task_path};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, store, task};
use chrono::Utc;
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[tokio::test]
async fn test_runner_branches_not_due_and_disabled() {
    let app = fixture();
    let mut t = task("page-audit");
    t.next_run_at = "2999-01-01T00:00:00Z".into();
    store(&app, &t);

    let executed = Arc::new(AtomicUsize::new(0));
    let e_clone = executed.clone();
    let res = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            e_clone.fetch_add(1, Ordering::SeqCst);
            async { Ok(Value::Null) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await;
    assert!(res.is_ok());
    assert_eq!(executed.load(Ordering::SeqCst), 0);

    let app2 = fixture();
    let mut disabled = task("page-audit");
    disabled.enabled = false;
    store(&app2, &disabled);
    let unregistered = Arc::new(AtomicUsize::new(0));
    let u_clone = unregistered.clone();
    let res2 = run_scheduled_task_with(
        app2.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { Ok(Value::Null) },
        |_, _, _, _| Ok(()),
        move |_, _| {
            u_clone.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await;
    assert!(res2.is_ok());
    assert_eq!(unregistered.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn test_runner_branches_lock_failure_and_missing_manifest() {
    let app = fixture();
    let t = task("page-audit");
    store(&app, &t);
    let lock_file = task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .with_file_name("scheduled_execution_schedule-1.lock");
    let _guard = acquire_scheduled_lock(&lock_file).unwrap().unwrap();

    let executed = Arc::new(AtomicUsize::new(0));
    let e_clone = executed.clone();
    let res = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            e_clone.fetch_add(1, Ordering::SeqCst);
            async { Ok(Value::Null) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await;
    assert!(res.is_ok());
    assert_eq!(executed.load(Ordering::SeqCst), 0);

    let app2 = fixture();
    let res_missing = run_scheduled_task_with(
        app2.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { Ok(Value::Null) },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await;
    assert!(res_missing.is_err());
}

#[tokio::test]
async fn test_runner_branches_manifest_removed_during_execution() {
    let app = fixture();
    let t = task("page-audit");
    store(&app, &t);
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();

    let res = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let _ = std::fs::remove_file(&path);
            async { Ok(Value::Null) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await;
    assert!(res.is_err());
}

#[test]
fn test_direct_helpers_invocation() {
    let now = Utc::now();
    let due_str = now.to_rfc3339();
    assert!(now_is_due(&due_str, now).unwrap());

    let mut t = task("page-audit");
    let exec = super::super::super::models::ScheduledTaskExecution {
        started_at: now.to_rfc3339(),
        completed_at: now.to_rfc3339(),
        succeeded: true,
        error: None,
    };
    let next = finalize_task(&mut t, exec, true).unwrap();
    assert!(!next.is_empty());
}
