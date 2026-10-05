use super::{
    finish::finish_run, lock::queue_value, models::parse_snapshot, owner::QueueOwner,
    test_fixture::snapshot,
};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use chrono::Utc;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tauri::test::mock_builder;

#[test]
fn stop_between_last_item_and_final_publication_is_recorded_instead_of_left_running() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run");
    initial["items"] = json!([]);
    save_project_audit_queue(app.clone(), "one".into(), initial.clone()).unwrap();
    let state = read_queue_state(&app, "one").unwrap();
    let retired = Arc::new(Mutex::new(Vec::new()));
    let record = retired.clone();
    let owner = QueueOwner {
        app: app.clone(),
        project_id: "one".into(),
        run_id: "run".into(),
        generation: state.generation,
        retire: Box::new(move |project, run| record.lock().unwrap().push((project, run))),
    };
    let original = parse_snapshot(initial.clone()).unwrap();
    let run = original.run.clone().unwrap();
    // This is the precise boundary after the final item and before the worker's
    // conditional final write. Foreground cancellation owns the new snapshot.
    initial["run"]["stopRequested"] = json!(true);
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();
    finish_run(owner, original, run, None, Utc::now()).unwrap();
    let current = load_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(current["run"]["status"], "stopped");
    assert_eq!(current["run"]["stopRequested"], true);
    let executions = list_project_audit_queue_executions(app, "one".into()).unwrap();
    assert_eq!(executions.len(), 1);
    assert_eq!(executions[0]["stopped"], true);
    assert_eq!(
        *retired.lock().unwrap(),
        vec![("one".to_owned(), "run".to_owned())]
    );
}

#[test]
fn final_publication_does_not_recreate_deleted_or_identically_restored_state() {
    for restore in [false, true] {
        let fixture = StorageApp::new(mock_builder());
        let app = fixture.handle();
        let current = parse_snapshot(snapshot("run")).unwrap();
        let initial = queue_value(&current).unwrap();
        save_project_audit_queue(app.clone(), "one".into(), initial.clone()).unwrap();
        let state = read_queue_state(&app, "one").unwrap();
        let owner = QueueOwner {
            app: app.clone(),
            project_id: "one".into(),
            run_id: "run".into(),
            generation: state.generation,
            retire: Box::new(|_, _| panic!("obsolete worker retired a scheduler job")),
        };
        let run = current.run.clone().unwrap();
        delete_project_audit_queue(app.clone(), "one".into()).unwrap();
        if restore {
            save_project_audit_queue(app.clone(), "one".into(), initial.clone()).unwrap();
        }
        finish_run(owner, current, run, None, Utc::now()).unwrap();
        assert_eq!(
            load_project_audit_queue(app.clone(), "one".into()).unwrap(),
            if restore { initial } else { Value::Null }
        );
        assert!(list_project_audit_queue_executions(app, "one".into())
            .unwrap()
            .is_empty());
    }
}
