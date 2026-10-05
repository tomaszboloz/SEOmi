use super::{
    test_fixture::run_audit_queue_with,
    test_fixture::{audit, snapshot},
};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::Value;
use tauri::test::mock_builder;

#[tokio::test]
async fn deleted_replaced_or_restored_queue_discards_inflight_success() {
    for operation in ["delete", "replace", "restore-identical"] {
        let fixture = StorageApp::new(mock_builder());
        let app = fixture.handle();
        save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
        let inspector_app = app.clone();
        run_audit_queue_with(app.clone(), "one".into(), "run".into(), move |url, _| {
            let app = inspector_app.clone();
            async move {
                assert_eq!(url, "https://example.test/first");
                let running = load_project_audit_queue(app.clone(), "one".into()).unwrap();
                let observed = audit(url).await?;
                delete_project_audit_queue(app.clone(), "one".into()).unwrap();
                match operation {
                    "replace" => {
                        save_project_audit_queue(app, "one".into(), snapshot("replacement"))
                            .unwrap()
                    }
                    "restore-identical" => {
                        save_project_audit_queue(app, "one".into(), running).unwrap()
                    }
                    _ => (),
                }
                Ok(observed)
            }
        })
        .await
        .unwrap();
        let current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
        match operation {
            "delete" => assert_eq!(current, Value::Null),
            "replace" => assert_eq!(current["run"]["id"], "replacement"),
            _ => {
                assert_eq!(current["items"][0]["status"], "running");
                assert_eq!(current["items"][1]["status"], "queued");
            }
        }
        assert!(list_project_audit_queue_results(app.clone(), "one".into())
            .unwrap()
            .is_empty());
        assert!(list_project_audit_queue_executions(app, "one".into())
            .unwrap()
            .is_empty());
    }
}

#[tokio::test]
async fn stop_during_inspection_is_retained_and_interrupts_without_publishing_old_audit() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
    let inspector_app = app.clone();
    run_audit_queue_with(app.clone(), "one".into(), "run".into(), move |url, _| {
        let app = inspector_app.clone();
        async move {
            assert_eq!(url, "https://example.test/first");
            let mut current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
            current["run"]["stopRequested"] = true.into();
            current["extra"] = "foreground annotation".into();
            save_project_audit_queue(app, "one".into(), current).unwrap();
            audit(url).await
        }
    })
    .await
    .unwrap();
    let current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(current["run"]["status"], "stopped");
    assert_eq!(current["run"]["stopRequested"], true);
    assert_eq!(current["run"]["activeItemId"], Value::Null);
    assert_eq!(current["items"][0]["status"], "interrupted");
    assert_eq!(current["items"][1]["status"], "queued");
    assert!(list_project_audit_queue_results(app.clone(), "one".into())
        .unwrap()
        .is_empty());
    let executions = list_project_audit_queue_executions(app, "one".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["stopped"], true);
    assert_eq!(executions[0]["runId"], "run");
}
