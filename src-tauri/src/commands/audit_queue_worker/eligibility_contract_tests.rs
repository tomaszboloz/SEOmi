use super::{test_fixture::run_audit_queue_with, test_fixture::snapshot};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tauri::test::mock_builder;

#[tokio::test]
async fn ineligible_absent_or_finished_runs_never_dispatch_an_inspection() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let calls = Arc::new(AtomicUsize::new(0));
    for case in [
        "absent",
        "no-run",
        "different-run",
        "completed",
        "stopped",
        "stop-request",
        "fresh",
        "completed-items",
    ] {
        delete_project_audit_queue(app.clone(), "one".into()).unwrap();
        let mut current = snapshot("run");
        match case {
            "no-run" => current["run"] = Value::Null,
            "different-run" => current["run"]["id"] = json!("other"),
            "completed" | "stopped" => current["run"]["status"] = json!(case),
            "stop-request" => current["run"]["stopRequested"] = json!(true),
            "fresh" => current["run"]["updatedAt"] = json!(chrono::Utc::now().to_rfc3339()),
            "completed-items" => {
                for item in current["items"].as_array_mut().unwrap() {
                    item["status"] = json!("completed");
                }
            }
            _ => (),
        }
        if case != "absent" {
            save_project_audit_queue(app.clone(), "one".into(), current.clone()).unwrap();
        }
        let count = calls.clone();
        run_audit_queue_with(app.clone(), "one".into(), "run".into(), move |_, _| {
            count.fetch_add(1, Ordering::SeqCst);
            async { Err("unexpected call".into()) }
        })
        .await
        .unwrap();
        if !matches!(case, "absent" | "completed-items") {
            assert_eq!(
                load_project_audit_queue(app.clone(), "one".into()).unwrap(),
                current
            );
        }
        if case == "completed-items" {
            assert_eq!(
                load_project_audit_queue(app.clone(), "one".into()).unwrap()["run"]["status"],
                "completed"
            );
        }
    }
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}
