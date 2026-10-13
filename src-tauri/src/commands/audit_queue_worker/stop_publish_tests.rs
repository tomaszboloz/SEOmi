use super::super::{models::parse_snapshot, owner::QueueOwner, test_fixture::snapshot};
use super::handle_stop_requested;
use crate::commands::audit_queue::{read_queue_state, save_project_audit_queue};
use crate::utils::test_app::StorageApp;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::test::mock_builder;

fn run_stop(expected_matches: bool) -> (Vec<(String, String)>, Option<String>) {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), snapshot("run")).unwrap();
    let state = read_queue_state(&app, "one").unwrap();
    let raw = state.snapshot.unwrap();
    let retired = Arc::new(Mutex::new(Vec::new()));
    let sink = retired.clone();
    let owner = QueueOwner {
        app: app.clone(),
        project_id: "one".into(),
        run_id: "run".into(),
        generation: state.generation.clone(),
        retire: Box::new(move |project, run| sink.lock().unwrap().push((project, run))),
    };
    let current = parse_snapshot(raw.clone()).unwrap();
    let run = current.run.clone().unwrap();
    let stale = json!({"items": [], "run": null});
    let expected = if expected_matches { &raw } else { &stale };
    let error = Some("boom".to_string());
    handle_stop_requested(
        &owner,
        (expected, state.generation.as_deref()),
        current,
        run,
        &error,
    )
    .unwrap();
    let status = read_queue_state(&app, "one").unwrap().snapshot.unwrap()["run"]["status"]
        .as_str()
        .map(str::to_string);
    let retired = retired.lock().unwrap().clone();
    (retired, status)
}

#[test]
fn stop_publishes_and_retires_only_when_the_queue_is_still_current() {
    let (retired, status) = run_stop(true);
    assert_eq!(retired, vec![("one".to_string(), "run".to_string())]);
    assert_eq!(status.as_deref(), Some("stopped"));
}

#[test]
fn stale_expected_snapshot_neither_publishes_nor_retires() {
    let (retired, status) = run_stop(false);
    assert!(retired.is_empty());
    assert_eq!(status.as_deref(), Some("running"));
}
