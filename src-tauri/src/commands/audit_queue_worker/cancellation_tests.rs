use super::test_fixture::{audit, run_audit_queue_with, snapshot};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tauri::test::mock_builder;

#[tokio::test]
async fn worker_idles_when_run_is_already_stopped_or_stop_requested() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run");
    initial["run"]["stopRequested"] = json!(true);
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();

    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    run_audit_queue_with(app.clone(), "one".into(), "run".into(), move |_, _| {
        seen.fetch_add(1, Ordering::SeqCst);
        async { panic!("must not inspect when stop requested") }
    })
    .await
    .unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 0);

    let mut stopped_snap = snapshot("run2");
    stopped_snap["run"]["id"] = json!("run2");
    stopped_snap["run"]["status"] = json!("stopped");
    save_project_audit_queue(app.clone(), "one".into(), stopped_snap).unwrap();
    run_audit_queue_with(app, "one".into(), "run2".into(), |_, _| async {
        panic!("must not inspect stopped run")
    })
    .await
    .unwrap();
}

#[tokio::test]
async fn in_flight_stop_signal_marks_running_items_interrupted_and_retires_queue() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let initial = snapshot("run");
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();

    let app_clone = app.clone();
    let retire_count = Arc::new(AtomicUsize::new(0));
    let seen_retire = retire_count.clone();

    super::execution::run_audit_queue_with(
        app.clone(),
        "one".into(),
        "run".into(),
        move |url, _| {
            let app_inner = app_clone.clone();
            async move {
                if url.ends_with("first") {
                    let mut current =
                        load_project_audit_queue(app_inner.clone(), "one".into()).unwrap();
                    current["run"]["stopRequested"] = json!(true);
                    save_project_audit_queue(app_inner, "one".into(), current).unwrap();
                }
                audit(url).await
            }
        },
        move |_, _| {
            seen_retire.fetch_add(1, Ordering::SeqCst);
        },
    )
    .await
    .unwrap();

    let state = load_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(state["run"]["status"], "stopped");
    assert_eq!(state["run"]["stopRequested"], true);
    assert_eq!(state["run"]["activeItemId"], Value::Null);

    let items = state["items"].as_array().unwrap();
    assert_eq!(items[0]["status"], "interrupted");

    let executions = list_project_audit_queue_executions(app, "one".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["stopped"], true);
    assert_eq!(retire_count.load(Ordering::SeqCst), 1);
}
