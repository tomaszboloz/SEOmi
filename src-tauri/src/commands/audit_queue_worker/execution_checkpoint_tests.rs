use super::execution::{ensure_directory, run_audit_queue_checked, Checkpoint};
use super::test_fixture::{audit, snapshot};
use crate::commands::audit_queue::*;
use crate::utils::test_app::StorageApp;
use serde_json::json;
use tauri::test::mock_builder;

async fn run_with_change_at(trigger: Checkpoint) -> serde_json::Value {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let mut initial = snapshot("run-race");
    initial["items"] = json!([{"id": "item-1", "url": "https://example.com", "status": "queued"}]);
    save_project_audit_queue(app.clone(), "one".into(), initial).unwrap();
    let changing_app = app.clone();
    run_audit_queue_checked(
        app.clone(),
        "one".into(),
        "run-race".into(),
        |url, _| audit(url),
        |_, _| {},
        move |point| {
            if point == trigger {
                let mut current =
                    load_project_audit_queue(changing_app.clone(), "one".into()).unwrap();
                current["touchedBy"] = json!("another process");
                save_project_audit_queue(changing_app.clone(), "one".into(), current).unwrap();
            }
        },
    )
    .await
    .unwrap();
    load_project_audit_queue(app, "one".into()).unwrap()
}

#[tokio::test]
async fn a_queue_changed_after_locking_is_left_to_its_new_owner() {
    let queue = run_with_change_at(Checkpoint::Locked).await;
    assert_eq!(queue["touchedBy"], "another process");
    assert_eq!(queue["items"][0]["status"], "queued");
}

#[tokio::test]
async fn a_queue_changed_after_starting_is_left_to_its_new_owner() {
    let queue = run_with_change_at(Checkpoint::Started).await;
    assert_eq!(queue["touchedBy"], "another process");
    assert_ne!(queue["items"][0]["status"], "completed");
}

#[test]
fn ensure_directory_reports_paths_that_are_files() {
    let directory = std::env::temp_dir().join(format!("seomi-ensure-{}", uuid::Uuid::new_v4()));
    ensure_directory(&directory).unwrap();
    let file = directory.join("file");
    std::fs::write(&file, b"x").unwrap();
    let error = ensure_directory(&file.join("child")).unwrap_err();
    assert!(error.starts_with("Unable to create audit queue directory: "));
    std::fs::remove_dir_all(directory).unwrap();
}
