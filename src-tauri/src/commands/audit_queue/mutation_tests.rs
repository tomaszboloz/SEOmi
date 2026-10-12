use super::*;
use crate::utils::file_lock::acquire_file_lock;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[test]
fn lock_queue_acquires_lock_successfully_and_releases_on_drop() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let lock = lock_queue(&app, "project-1").expect("lock queue");
    let lock_path = fixture
        .project("project-1")
        .join("audit_queue_mutation.lock");
    assert!(lock_path.exists());
    assert!(acquire_file_lock(&lock_path).unwrap().is_none());
    drop(lock);
    assert!(acquire_file_lock(&lock_path).unwrap().is_some());
}

#[test]
fn lock_queue_fails_when_directory_is_a_file() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let project_path = fixture.project("project-1");
    fs::create_dir_all(project_path.parent().unwrap()).unwrap();
    fs::write(&project_path, b"not-a-directory").unwrap();
    let Err(err) = lock_queue(&app, "project-1") else {
        panic!("expected error")
    };
    assert!(err.contains("Unable to create audit queue directory:"));
}

#[test]
fn lock_queue_fails_when_lock_path_is_a_directory() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let lock_path = fixture
        .project("project-1")
        .join("audit_queue_mutation.lock");
    fs::create_dir_all(&lock_path).unwrap();
    let Err(err) = lock_queue(&app, "project-1") else {
        panic!("expected error")
    };
    assert!(err.contains("Unable to lock audit queue mutation:"));
}

#[test]
fn lock_queue_rejects_invalid_project_identifier() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    let Err(err) = lock_queue(&app, "invalid/project/id") else {
        panic!("expected error")
    };
    assert!(err.contains("Invalid project identifier"));
}

#[test]
fn snapshot_writer_rejects_non_object_values_and_result_paths_check_every_identifier() {
    use crate::commands::audit_queue::paths::queue_result_path;
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();
    for value in [
        serde_json::json!([]),
        serde_json::json!("text"),
        Value::Null,
    ] {
        assert_eq!(
            write_snapshot_unlocked(&app, "project-1", &value).unwrap_err(),
            "Audit queue storage expects a JSON object."
        );
    }
    write_snapshot_unlocked(&app, "project-1", &serde_json::json!({})).unwrap();
    let path = queue_result_path(&app, "project-1", "run-1_a", "item-2_b").unwrap();
    assert!(path.ends_with("audit_queue_result_run-1_a_item-2_b.json"));
    let too_long = "a".repeat(81);
    for (run, item) in [
        ("", "i"),
        ("r", ""),
        ("r/x", "i"),
        ("r", "i.j"),
        ("r", &too_long[..]),
    ] {
        assert_eq!(
            queue_result_path(&app, "project-1", run, item).unwrap_err(),
            "Invalid audit queue result identifier."
        );
    }
}
