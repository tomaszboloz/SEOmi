use super::{run_audit_queue, test_fixture::snapshot};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn run_audit_queue_executes_stale_queue_calling_inspection_closure() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-prod");
    initial["items"] = json!([{"id": "item-1", "url": "http://127.0.0.1", "status": "queued"}]);
    save_project_audit_queue(app.clone(), "project-1".into(), initial).unwrap();

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-prod".into()).await;
    assert!(result.is_ok());

    let current = load_project_audit_queue(app.clone(), "project-1".into()).unwrap();
    assert_eq!(current["run"]["status"], "stopped");
    assert_eq!(current["items"][0]["status"], "failed");
    assert!(current["items"][0]["error"]
        .as_str()
        .unwrap()
        .contains("URL validation failed"));

    let executions = list_project_audit_queue_executions(app, "project-1".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["succeeded"], false);
}

#[tokio::test]
async fn run_audit_queue_returns_ok_when_run_is_none() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-none");
    initial["run"] = serde_json::Value::Null;
    save_project_audit_queue(app.clone(), "project-1".into(), initial.clone()).unwrap();
    assert!(
        run_audit_queue(app.clone(), "project-1".into(), "run-none".into())
            .await
            .is_ok()
    );
    assert_eq!(
        load_project_audit_queue(app, "project-1".into()).unwrap(),
        initial
    );
}

#[tokio::test]
async fn run_audit_queue_returns_ok_when_stop_requested() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-stop");
    initial["run"]["stopRequested"] = json!(true);
    save_project_audit_queue(app.clone(), "project-1".into(), initial.clone()).unwrap();
    assert!(
        run_audit_queue(app.clone(), "project-1".into(), "run-stop".into())
            .await
            .is_ok()
    );
    assert_eq!(
        load_project_audit_queue(app, "project-1".into()).unwrap(),
        initial
    );
}

#[tokio::test]
async fn run_audit_queue_returns_ok_when_queue_not_stale() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-fresh");
    initial["run"]["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
    save_project_audit_queue(app.clone(), "project-1".into(), initial.clone()).unwrap();
    assert!(
        run_audit_queue(app.clone(), "project-1".into(), "run-fresh".into())
            .await
            .is_ok()
    );
    assert_eq!(
        load_project_audit_queue(app, "project-1".into()).unwrap(),
        initial
    );
}

#[tokio::test]
async fn run_audit_queue_returns_ok_when_queue_empty() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    assert!(run_audit_queue(app, "project-1".into(), "run-empty".into())
        .await
        .is_ok());
}

#[tokio::test]
async fn run_audit_queue_returns_ok_when_lock_cannot_be_acquired() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let initial = snapshot("run-lock");
    save_project_audit_queue(app.clone(), "project-1".into(), initial).unwrap();
    let lock_path = fixture
        .project("project-1")
        .join("audit_queue_execution_run-lock.lock");
    let _lock = super::lock::acquire_lock(&lock_path).unwrap().unwrap();
    assert!(run_audit_queue(app, "project-1".into(), "run-lock".into())
        .await
        .is_ok());
}

#[tokio::test]
async fn run_audit_queue_stops_when_item_processing_fails_ownership() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-proc");
    initial["items"] = json!([{"id": "item-1", "url": "https://example.com", "status": "queued"}]);
    save_project_audit_queue(app.clone(), "project-1".into(), initial).unwrap();
    let app_clone = app.clone();
    let res = super::execution::run_audit_queue_with(
        app.clone(),
        "project-1".into(),
        "run-proc".into(),
        move |url, _| {
            delete_project_audit_queue(app_clone.clone(), "project-1".into()).unwrap();
            async move { super::test_fixture::audit(url).await }
        },
        |_, _| {},
    )
    .await;
    assert!(res.is_ok());
}

#[tokio::test]
async fn run_audit_queue_publishes_handoff_when_all_items_processed() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-handoff");
    initial["items"] = json!([]);
    save_project_audit_queue(app.clone(), "project-1".into(), initial).unwrap();
    assert!(
        run_audit_queue(app.clone(), "project-1".into(), "run-handoff".into())
            .await
            .is_ok()
    );
    let current = load_project_audit_queue(app.clone(), "project-1".into()).unwrap();
    assert_eq!(current["run"]["status"], "completed");
    let executions = list_project_audit_queue_executions(app, "project-1".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["succeeded"], true);
}
