use super::*;
use crate::commands::audit_queue::executions::list_project_audit_queue_results_bounded;
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

#[test]
fn list_results_bounded_breaks_at_cap() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-bounded-res").unwrap();
    fs::create_dir_all(&dir).unwrap();
    for i in 0..4 {
        fs::write(
            dir.join(format!("audit_queue_result_r_{i}.json")),
            format!("{{\"idx\":{i}}}"),
        )
        .unwrap();
    }
    let res = list_project_audit_queue_results_bounded(app, "proj-bounded-res".into(), 2).unwrap();
    assert_eq!(res.len(), 2);
}

#[test]
fn list_executions_fails_when_saved_execution_is_invalid_json() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-corrupt-exec").unwrap();
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("audit_queue_execution_bad.json"), b"invalid json").unwrap();

    let err = list_project_audit_queue_executions(app, "proj-corrupt-exec".into()).unwrap_err();
    assert!(err.contains("Saved audit queue execution is invalid"));
}

#[test]
fn list_executions_breaks_at_cap() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-bounded-exec").unwrap();
    fs::create_dir_all(&dir).unwrap();
    for i in 0..102 {
        fs::write(dir.join(format!("audit_queue_execution_{i}.json")), b"{}").unwrap();
    }
    let res = list_project_audit_queue_executions(app, "proj-bounded-exec".into()).unwrap();
    assert_eq!(res.len(), 100);
}

#[test]
fn acknowledge_fails_when_path_is_directory() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-ack-err").unwrap();
    fs::create_dir_all(dir.join("audit_queue_result_run1_item1.json")).unwrap();
    fs::create_dir_all(dir.join("audit_queue_execution_run1.json")).unwrap();

    let res_err = acknowledge_project_audit_queue_result(
        app.clone(),
        "proj-ack-err".into(),
        "run1".into(),
        "item1".into(),
    )
    .unwrap_err();
    assert!(res_err.contains("Unable to acknowledge audit queue result"));

    let exec_err = acknowledge_project_audit_queue_execution(
        app.clone(),
        "proj-ack-err".into(),
        "run1".into(),
    )
    .unwrap_err();
    assert!(exec_err.contains("Unable to acknowledge audit queue execution"));

    let dir_err = crawl_storage::project_directory(&app, "proj-dir-err").unwrap();
    fs::create_dir_all(dir_err.join("audit_queue.json")).unwrap();

    let load_err = load_project_audit_queue(app.clone(), "proj-dir-err".into()).unwrap_err();
    assert!(load_err.contains("Unable to read audit queue"));

    let read_err = read_queue_snapshot(&app, "proj-dir-err").unwrap_err();
    assert!(read_err.contains("Unable to read audit queue"));

    let del_err = delete_project_audit_queue(app, "proj-dir-err".into()).unwrap_err();
    assert!(del_err.contains("Unable to remove audit queue"));
}
