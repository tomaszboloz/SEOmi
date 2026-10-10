use super::*;
use crate::commands::audit_queue::paths::{MAX_QUEUE_EXECUTION_BYTES, MAX_QUEUE_RESULT_BYTES};
use crate::commands::crawl_storage;
use std::fs;

#[test]
fn read_queue_snapshot_handles_missing_file_and_corrupt_json() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    assert_eq!(read_queue_snapshot(&app, "missing-proj").unwrap(), None);

    let dir = crawl_storage::project_directory(&app, "corrupt-proj").unwrap();
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("audit_queue.json"), b"{not-valid-json}").unwrap();
    let err = read_queue_snapshot(&app, "corrupt-proj").unwrap_err();
    assert!(err.contains("Saved audit queue is invalid"));
}

#[test]
fn delete_queue_removes_handoff_files_even_when_queue_file_missing() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-cleanup").unwrap();
    fs::create_dir_all(&dir).unwrap();

    let exec_file = dir.join("audit_queue_execution_run1.json");
    let res_file = dir.join("audit_queue_result_run1_item1.json");
    let other_file = dir.join("custom_keep.txt");
    fs::write(&exec_file, b"{}").unwrap();
    fs::write(&res_file, b"{}").unwrap();
    fs::write(&other_file, b"keep me").unwrap();

    delete_project_audit_queue(app, "proj-cleanup".into()).unwrap();
    assert!(!exec_file.exists());
    assert!(!res_file.exists());
    assert!(other_file.exists());
}

#[test]
fn write_execution_and_result_reject_oversized_payloads() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let big_exec = json!({ "blob": "x".repeat(MAX_QUEUE_EXECUTION_BYTES) });
    let err = write_queue_execution(&app, "proj-oversize", "run-1", &big_exec).unwrap_err();
    assert!(err.contains("Audit queue execution exceeds the safety limit"));

    let big_res = json!({ "blob": "x".repeat(MAX_QUEUE_RESULT_BYTES) });
    let err = write_queue_result(&app, "proj-oversize", "run-1", "item-1", &big_res).unwrap_err();
    assert!(err.contains("Audit queue result exceeds the safety limit"));
}

#[test]
fn list_results_fails_when_saved_result_is_invalid_json() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-corrupt-res").unwrap();
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("audit_queue_result_bad.json"), b"invalid json").unwrap();

    let err = list_project_audit_queue_results(app, "proj-corrupt-res".into()).unwrap_err();
    assert!(err.contains("Saved audit queue result is invalid"));
}
