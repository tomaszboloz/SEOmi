use super::test_fixture::run_audit_queue_with;
use super::test_fixture::snapshot;
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use chrono::Utc;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tauri::test::mock_builder;

#[tokio::test]
async fn deleted_queue_is_not_recreated_by_an_inflight_failure() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    let inspector_app = app.clone();
    run_audit_queue_with(app.clone(), "one".into(), "run".into(), move |url, _| {
        let app = inspector_app.clone();
        counter.fetch_add(1, Ordering::SeqCst);
        async move {
            assert_eq!(url, "https://example.test/first");
            let running = load_project_audit_queue(app.clone(), "one".into()).unwrap();
            assert_eq!(running["run"]["activeItemId"], "first");
            tokio::task::yield_now().await;
            delete_project_audit_queue(app, "one".into()).unwrap();
            Err("late network failure".into())
        }
    })
    .await
    .unwrap();
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        load_project_audit_queue(app.clone(), "one".into()).unwrap(),
        Value::Null
    );
    assert!(list_project_audit_queue_results(app.clone(), "one".into())
        .unwrap()
        .is_empty());
    assert!(list_project_audit_queue_executions(app, "one".into())
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn replacement_queue_is_preserved_after_an_inflight_failure() {
    for replacement_run in ["new-run", "run"] {
        let fixture = StorageApp::new(mock_builder());
        let app = fixture.handle();
        save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
        let mut replacement = snapshot(replacement_run);
        replacement["items"] = json!([]);
        replacement["run"]["updatedAt"] = json!(Utc::now().to_rfc3339());
        let expected = replacement.clone();
        let inspector_app = app.clone();
        run_audit_queue_with(app.clone(), "one".into(), "run".into(), move |_, _| {
            let app = inspector_app.clone();
            let replacement = replacement.clone();
            async move {
                tokio::task::yield_now().await;
                save_project_audit_queue(app, "one".into(), replacement).unwrap();
                Err("obsolete network failure".into())
            }
        })
        .await
        .unwrap();
        assert_eq!(
            load_project_audit_queue(app.clone(), "one".into()).unwrap(),
            expected
        );
        assert!(list_project_audit_queue_executions(app, "one".into())
            .unwrap()
            .is_empty());
    }
}
