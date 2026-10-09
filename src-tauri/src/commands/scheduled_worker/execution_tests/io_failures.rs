use super::super::super::storage::{execution_path, result_path, task_path};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, read_task, store, task};
use serde_json::{json, Value};
use std::fs;

#[tokio::test]
async fn initial_manifest_update_reports_a_write_lock_failure() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let lock = task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .with_extension("json.write.lock");
    fs::remove_file(&lock).unwrap();
    fs::create_dir_all(&lock).unwrap();

    let error = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { panic!("write failure must happen before execution") },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();

    assert!(error.contains("Unable to persist scheduled data"));
    assert_eq!(read_task(&app, "schedule-1").status, "scheduled");
}

#[tokio::test]
async fn result_directory_surfaces_atomic_result_write_failure() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let result = result_path(&app.handle(), "project-1", "schedule-1").unwrap();
    fs::create_dir_all(&result).unwrap();

    let error = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { Ok(json!({"fixture": true})) },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();

    assert!(error.contains("Unable to persist scheduled data"));
    assert_eq!(read_task(&app, "schedule-1").status, "completed");
    assert!(result.is_dir());
}

#[tokio::test]
async fn metadata_directory_surfaces_handoff_write_failure_after_result() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let metadata = execution_path(&app.handle(), "project-1", "schedule-1").unwrap();
    fs::create_dir_all(&metadata).unwrap();

    let error = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        |_| async { Ok(json!({"fixture": "handoff"})) },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();

    assert!(error.contains("Unable to persist scheduled data"));
    assert!(metadata.is_dir());
    assert!(result_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .is_file());
}

#[tokio::test]
async fn invalid_latest_manifest_is_rejected_before_scheduler_update() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();

    let error = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let mut latest = task("page-audit");
            latest.status = "unknown".into();
            fs::write(&path, serde_json::to_vec(&latest).unwrap()).unwrap();
            async { Ok::<Value, String>(Value::Null) }
        },
        |_, _, _, _| panic!("invalid latest manifest must stop before scheduling"),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();

    assert_eq!(error, "Unsupported scheduled task status.");
}
