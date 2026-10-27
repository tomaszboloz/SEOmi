use super::super::super::models::MAX_EXECUTION_BYTES;
use super::super::super::storage::{result_path, task_path, write_json_atomic};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, read_task, read_value, store, task};
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[tokio::test]
async fn outcome_error_exceeding_500_chars_is_truncated_and_deletes_old_result() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let res_path = result_path(&app.handle(), "project-1", "schedule-1").unwrap();
    std::fs::write(&res_path, b"{\"stale\":true}").unwrap();
    assert!(res_path.exists());

    let long_error = format!("ERR:{}", "y".repeat(600));
    let expected_500: String = long_error.chars().take(500).collect();

    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let err = long_error.clone();
            async move { Err::<Value, _>(err) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap();

    assert!(
        !res_path.exists(),
        "stale result_path must be deleted on error"
    );

    let current = read_task(&app, "schedule-1");
    assert_eq!(current.status, "failed");
    assert_eq!(
        current.last_error.as_deref().unwrap(),
        expected_500.as_str()
    );

    let handoff = read_value(&app, "schedule-1");
    assert_eq!(handoff["succeeded"], false);
    assert_eq!(handoff["error"].as_str().unwrap(), expected_500.as_str());
}

#[tokio::test]
async fn task_disabled_during_execution_unregisters_instead_of_register() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    let unregisters = Arc::new(AtomicUsize::new(0));
    let seen_unregister = unregisters.clone();

    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let mut latest = task("page-audit");
            latest.enabled = false;
            write_json_atomic(
                &path,
                &serde_json::to_value(latest).unwrap(),
                MAX_EXECUTION_BYTES,
            )
            .unwrap();
            async { Ok(json!({"done": true})) }
        },
        |_, _, _, _| panic!("disabled task must not register with scheduler"),
        move |project, schedule| {
            assert_eq!(
                (project.as_str(), schedule.as_str()),
                ("project-1", "schedule-1")
            );
            seen_unregister.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
    )
    .await
    .unwrap();

    assert_eq!(unregisters.load(Ordering::SeqCst), 1);
    let current = read_task(&app, "schedule-1");
    assert!(!current.enabled);
}
