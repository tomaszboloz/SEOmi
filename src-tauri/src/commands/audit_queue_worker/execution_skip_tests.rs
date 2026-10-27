use super::{run_audit_queue, test_fixture::snapshot};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn run_audit_queue_skips_completed_items_and_processes_remaining() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-skip");
    initial["items"] = json!([
        {
            "id": "first",
            "url": "https://example.test/completed",
            "status": "completed",
            "attempts": 1
        },
        {
            "id": "second",
            "url": "http://127.0.0.1",
            "status": "queued",
            "attempts": 0
        }
    ]);
    save_project_audit_queue(app.clone(), "project-1".into(), initial).unwrap();

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-skip".into()).await;
    assert!(result.is_ok());

    let current = load_project_audit_queue(app, "project-1".into()).unwrap();
    assert_eq!(current["items"][0]["status"], "completed");
    assert_eq!(current["items"][0]["attempts"], 1);
    assert_eq!(current["items"][1]["status"], "failed");
    assert_eq!(current["items"][1]["attempts"], 1);
}

#[tokio::test]
async fn run_audit_queue_finishes_with_completed_when_all_items_already_completed() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-all-done");
    initial["items"] = json!([
        {
            "id": "item-1",
            "url": "https://example.test/1",
            "status": "completed",
            "attempts": 1
        }
    ]);
    save_project_audit_queue(app.clone(), "project-1".into(), initial).unwrap();

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-all-done".into()).await;
    assert!(result.is_ok());

    let current = load_project_audit_queue(app.clone(), "project-1".into()).unwrap();
    assert_eq!(current["run"]["status"], "completed");
    assert_eq!(current["items"][0]["status"], "completed");

    let executions = list_project_audit_queue_executions(app, "project-1".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["succeeded"], true);
}

#[tokio::test]
async fn run_audit_queue_skips_when_run_id_does_not_match() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let initial = snapshot("run-other");
    save_project_audit_queue(app.clone(), "project-1".into(), initial.clone()).unwrap();

    let result = run_audit_queue(app.clone(), "project-1".into(), "run-mismatch".into()).await;
    assert!(result.is_ok());
    assert_eq!(
        load_project_audit_queue(app, "project-1".into()).unwrap(),
        initial
    );
}
