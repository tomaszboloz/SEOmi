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
    initial["items"] = json!([
        {
            "id": "item-1",
            "url": "http://127.0.0.1",
            "status": "queued"
        }
    ]);
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

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-none".into()).await;
    assert!(result.is_ok());
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

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-stop".into()).await;
    assert!(result.is_ok());
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

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-fresh".into()).await;
    assert!(result.is_ok());
    assert_eq!(
        load_project_audit_queue(app, "project-1".into()).unwrap(),
        initial
    );
}
