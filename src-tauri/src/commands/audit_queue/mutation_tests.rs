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
