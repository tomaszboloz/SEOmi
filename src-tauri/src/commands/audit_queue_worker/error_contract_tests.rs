use super::{
    run_audit_queue,
    test_fixture::run_audit_queue_with,
    test_fixture::{audit, snapshot},
};
use crate::commands::audit_queue::*;
use crate::utils::{file_lock::acquire_file_lock, test_app::StorageApp};
use serde_json::{json, Value};
use std::fs;
use tauri::test::mock_builder;

#[tokio::test]
async fn production_worker_rejects_invalid_ids_and_returns_for_an_absent_queue() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    for (project, run) in [("../escape", "run"), ("one", ""), ("one", "bad run")] {
        assert_eq!(
            run_audit_queue(app.clone(), project.into(), run.into())
                .await
                .unwrap_err(),
            "Invalid project or queue run identifier."
        );
    }
    run_audit_queue(app.clone(), "one".into(), "run".into())
        .await
        .unwrap();
    assert_eq!(
        load_project_audit_queue(app, "one".into()).unwrap(),
        Value::Null
    );
}

#[tokio::test]
async fn malformed_snapshot_is_not_rewritten_and_never_dispatched() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let malformed = json!({"items":"invalid","run":null});
    save_project_audit_queue(app.clone(), "one".into(), malformed.clone()).unwrap();
    let error = run_audit_queue_with(app.clone(), "one".into(), "run".into(), |_, _| async {
        panic!("invalid queue dispatched")
    })
    .await
    .unwrap_err();
    assert!(error.contains("Saved audit queue is invalid"));
    assert_eq!(
        load_project_audit_queue(app, "one".into()).unwrap(),
        malformed
    );
}

#[tokio::test]
async fn an_existing_execution_lock_leaves_snapshot_unchanged_without_dispatch() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let initial = snapshot("run");
    save_project_audit_queue(app.clone(), "one".into(), initial.clone()).unwrap();
    let _lock = acquire_file_lock(
        &fixture
            .project("one")
            .join("audit_queue_execution_run.lock"),
    )
    .unwrap()
    .unwrap();
    run_audit_queue_with(app.clone(), "one".into(), "run".into(), |_, _| async {
        panic!("duplicate worker dispatched")
    })
    .await
    .unwrap();
    assert_eq!(
        load_project_audit_queue(app, "one".into()).unwrap(),
        initial
    );
}

#[tokio::test]
async fn failed_result_persistence_marks_the_item_failed_and_keeps_later_success() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
    fs::create_dir(
        fixture
            .project("one")
            .join("audit_queue_result_run_first.json"),
    )
    .unwrap();
    run_audit_queue_with(app.clone(), "one".into(), "run".into(), |url, _| audit(url))
        .await
        .unwrap();
    let current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(current["run"]["status"], "stopped");
    assert_eq!(current["items"][0]["status"], "failed");
    assert!(current["items"][0]["error"]
        .as_str()
        .unwrap()
        .contains("Unable to persist audit queue"));
    assert_eq!(current["items"][1]["status"], "completed");
    let second: Value = serde_json::from_slice(
        &fs::read(
            fixture
                .project("one")
                .join("audit_queue_result_run_second.json"),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(second["itemId"], "second");
    assert_eq!(second["audit"]["url"], "https://example.test/second");
    let executions = list_project_audit_queue_executions(app, "one".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["succeeded"], false);
    assert_eq!(executions[0]["error"], current["run"]["lastError"]);
}

#[tokio::test]
async fn attempts_saturate_at_the_storage_type_limit_instead_of_panicking_or_wrapping() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run");
    initial["items"][0]["attempts"] = json!(u32::MAX);
    initial["items"].as_array_mut().unwrap().truncate(1);
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();
    run_audit_queue_with(app.clone(), "one".into(), "run".into(), |_, _| async {
        Err("known failure".into())
    })
    .await
    .unwrap();
    let current = load_project_audit_queue(app, "one".into()).unwrap();
    assert_eq!(current["items"][0]["attempts"], u32::MAX);
    assert_eq!(current["items"][0]["status"], "failed");
}
