use super::{
    test_fixture::run_audit_queue_with,
    test_fixture::{audit, snapshot},
};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::{json, Value};
use tauri::test::mock_builder;

#[tokio::test]
async fn accepted_success_persists_exact_results_attempts_and_execution_without_crossing_projects()
{
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run");
    initial["run"]["userAgent"] = json!("Queue Agent");
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();
    save_project_audit_queue(app.clone(), "two".into(), json!({"retained":true})).unwrap();
    run_audit_queue_with(
        app.clone(),
        "one".into(),
        "run".into(),
        |url, agent| async move {
            assert_eq!(agent.as_deref(), Some("Queue Agent"));
            audit(url).await
        },
    )
    .await
    .unwrap();
    let current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(current["run"]["status"], "completed");
    assert_eq!(current["run"]["activeItemId"], Value::Null);
    assert_eq!(current["run"]["lastError"], Value::Null);
    for item in current["items"].as_array().unwrap() {
        assert_eq!(item["status"], "completed");
        assert_eq!(item["attempts"], 1);
        assert!(item["completedAt"].as_str().is_some());
        assert_eq!(item["error"], Value::Null);
    }
    let results = list_project_audit_queue_results(app.clone(), "one".into()).unwrap();
    assert_eq!(results.len(), 2);
    for result in results {
        let id = result["itemId"].as_str().unwrap();
        assert!(matches!(id, "first" | "second"));
        assert_eq!(result["runId"], "run");
        assert_eq!(result["audit"]["url"], format!("https://example.test/{id}"));
        assert_eq!(result["audit"]["http_status"], 200);
        assert_eq!(result["audit"]["response_time_ms"], 17);
    }
    let executions = list_project_audit_queue_executions(app.clone(), "one".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["succeeded"], true);
    assert_eq!(executions[0]["error"], Value::Null);
    assert_eq!(executions[0]["projectId"], "one");
    assert_eq!(executions[0]["runId"], "run");
    assert_eq!(
        load_project_audit_queue(app, "two".into()).unwrap(),
        json!({"retained":true})
    );
}

#[tokio::test]
async fn failures_are_bounded_and_failed_items_remain_pending_with_first_error() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run");
    initial["items"][0]["status"] = json!("failed");
    initial["items"][0]["attempts"] = json!(2);
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();
    run_audit_queue_with(
        app.clone(),
        "one".into(),
        "run".into(),
        |url, _| async move {
            if url.ends_with("first") {
                Err("ż".repeat(520))
            } else {
                Err("second failure".into())
            }
        },
    )
    .await
    .unwrap();
    let current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(current["run"]["status"], "stopped");
    assert_eq!(current["run"]["lastError"], "ż".repeat(520));
    assert_eq!(current["items"][0]["attempts"], 3);
    assert_eq!(current["items"][0]["error"], "ż".repeat(500));
    assert_eq!(current["items"][1]["error"], "second failure");
    assert!(list_project_audit_queue_results(app.clone(), "one".into())
        .unwrap()
        .is_empty());
    let executions = list_project_audit_queue_executions(app, "one".into()).unwrap();
    assert_eq!(executions[0]["succeeded"], false);
    assert_eq!(executions[0]["error"], "ż".repeat(520));
}
