use super::*;
use crate::commands::crawl_storage;
use std::fs;

#[test]
fn list_executions_iterates_directory_skipping_non_matching_files() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-iter-1").unwrap();
    fs::create_dir_all(&dir).unwrap();

    fs::write(
        dir.join("audit_queue_execution_run1.json"),
        serde_json::to_vec(&json!({"runId":"run1","succeeded":true})).unwrap(),
    )
    .unwrap();
    fs::write(
        dir.join("audit_queue_execution_run2.json"),
        serde_json::to_vec(&json!({"runId":"run2","succeeded":false,"error":"fail"})).unwrap(),
    )
    .unwrap();

    fs::write(dir.join("audit_queue_execution_run1.lock"), b"lock").unwrap();
    fs::write(dir.join("audit_queue_execution_run1.tmp"), b"tmp").unwrap();
    fs::write(dir.join("other_file.json"), b"{}").unwrap();
    fs::create_dir_all(dir.join("audit_queue_execution_subfolder")).unwrap();

    let mut executions =
        list_project_audit_queue_executions(app.clone(), "proj-iter-1".into()).unwrap();
    executions.sort_by_key(|e| e["runId"].as_str().unwrap().to_string());

    assert_eq!(executions.len(), 2);
    assert_eq!(executions[0]["runId"], "run1");
    assert_eq!(executions[0]["succeeded"], true);
    assert_eq!(executions[1]["runId"], "run2");
    assert_eq!(executions[1]["succeeded"], false);
}

#[test]
fn list_executions_fails_when_saved_execution_is_invalid_json() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-corrupt-exec").unwrap();
    fs::create_dir_all(&dir).unwrap();

    fs::write(
        dir.join("audit_queue_execution_bad.json"),
        b"not valid json",
    )
    .unwrap();

    let error = list_project_audit_queue_executions(app, "proj-corrupt-exec".into()).unwrap_err();
    assert!(error.contains("Saved audit queue execution is invalid"));
}

#[test]
fn list_results_iterates_directory_skipping_non_matching_files() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-iter-res").unwrap();
    fs::create_dir_all(&dir).unwrap();

    fs::write(
        dir.join("audit_queue_result_run1_item1.json"),
        serde_json::to_vec(&json!({"runId":"run1","itemId":"item1"})).unwrap(),
    )
    .unwrap();
    fs::write(
        dir.join("audit_queue_result_run1_item2.json"),
        serde_json::to_vec(&json!({"runId":"run1","itemId":"item2"})).unwrap(),
    )
    .unwrap();

    fs::write(dir.join("audit_queue_result_run1_item1.lock"), b"lock").unwrap();
    fs::write(dir.join("random.json"), b"{}").unwrap();
    fs::write(dir.join("audit_queue_result_noext"), b"{}").unwrap();
    fs::create_dir_all(dir.join("audit_queue_result_dir")).unwrap();

    let mut results =
        list_project_audit_queue_results(app.clone(), "proj-iter-res".into()).unwrap();
    results.sort_by_key(|r| r["itemId"].as_str().unwrap().to_string());

    assert_eq!(results.len(), 2);
    assert_eq!(results[0]["itemId"], "item1");
    assert_eq!(results[1]["itemId"], "item2");
}

#[test]
fn list_results_fails_when_saved_result_is_invalid_json() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let dir = crawl_storage::project_directory(&app, "proj-corrupt-res").unwrap();
    fs::create_dir_all(&dir).unwrap();

    fs::write(dir.join("audit_queue_result_bad.json"), b"{unclosed json").unwrap();

    let error = list_project_audit_queue_results(app, "proj-corrupt-res".into()).unwrap_err();
    assert!(error.contains("Saved audit queue result is invalid"));
}
