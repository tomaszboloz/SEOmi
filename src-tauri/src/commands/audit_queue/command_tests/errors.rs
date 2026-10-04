use super::*;

#[test]
fn public_reads_reject_oversized_sparse_files_without_parsing_them() {
    use super::super::paths::*;
    let fixture = Fixture::new();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(&project).unwrap();
    for (name, cap, kind) in [
        ("audit_queue.json", MAX_QUEUE_BYTES, 0),
        (
            "audit_queue_execution_run.json",
            MAX_QUEUE_EXECUTION_BYTES,
            1,
        ),
        (
            "audit_queue_result_run_item.json",
            MAX_QUEUE_RESULT_BYTES,
            2,
        ),
    ] {
        fs::File::create(project.join(name))
            .unwrap()
            .set_len(cap as u64 + 1)
            .unwrap();
        let error = match kind {
            0 => load_project_audit_queue(app.clone(), "one".into()).unwrap_err(),
            1 => list_project_audit_queue_executions(app.clone(), "one".into()).unwrap_err(),
            _ => list_project_audit_queue_results(app.clone(), "one".into()).unwrap_err(),
        };
        assert!(error.contains("Unable to read audit queue"));
        assert!(!error.contains("Saved audit queue"));
        fs::remove_file(project.join(name)).unwrap();
    }
}

#[test]
fn malformed_json_and_directory_read_failures_are_contextual() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(&project).unwrap();
    fs::write(project.join("audit_queue.json"), b"not JSON").unwrap();
    assert!(load_project_audit_queue(app.clone(), "one".into())
        .unwrap_err()
        .contains("Saved audit queue is invalid"));
    assert!(read_queue_snapshot(&app, "one")
        .unwrap_err()
        .contains("Saved audit queue is invalid"));
    for (name, is_execution) in [
        ("audit_queue_execution_run.json", true),
        ("audit_queue_result_run_item.json", false),
    ] {
        fs::write(project.join(name), b"not JSON").unwrap();
        let error = if is_execution {
            list_project_audit_queue_executions(app.clone(), "one".into()).unwrap_err()
        } else {
            list_project_audit_queue_results(app.clone(), "one".into()).unwrap_err()
        };
        assert!(error.contains("invalid"));
        fs::remove_file(project.join(name)).unwrap();
        fs::create_dir(project.join(name)).unwrap();
        let error = if is_execution {
            list_project_audit_queue_executions(app.clone(), "one".into()).unwrap_err()
        } else {
            list_project_audit_queue_results(app.clone(), "one".into()).unwrap_err()
        };
        assert!(error.contains("Unable to read audit queue"));
        fs::remove_dir(project.join(name)).unwrap();
    }
}

#[test]
fn invalid_identifiers_and_ack_directory_errors_are_contextual() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    for id in ["", "../escape", "run space"] {
        assert!(write_queue_execution(&app, "one", id, &json!({}))
            .unwrap_err()
            .contains("Invalid audit queue run"));
        assert!(write_queue_result(&app, "one", "run", id, &json!({}))
            .unwrap_err()
            .contains("Invalid audit queue result"));
    }
    let project = fixture.project("one");
    fs::create_dir_all(project.join("audit_queue_result_run_item.json")).unwrap();
    fs::create_dir_all(project.join("audit_queue_execution_run.json")).unwrap();
    assert!(acknowledge_project_audit_queue_result(
        app.clone(),
        "one".into(),
        "run".into(),
        "item".into()
    )
    .unwrap_err()
    .contains("Unable to acknowledge audit queue result"));
    assert!(
        acknowledge_project_audit_queue_execution(app, "one".into(), "run".into())
            .unwrap_err()
            .contains("Unable to acknowledge audit queue execution")
    );
}

#[test]
fn non_directory_project_storage_errors_are_reported_by_public_commands() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(project.parent().unwrap()).unwrap();
    fs::write(project, b"blocked directory").unwrap();
    assert!(
        list_project_audit_queue_executions(app.clone(), "one".into())
            .unwrap_err()
            .contains("Unable to list audit queue executions")
    );
    assert!(list_project_audit_queue_results(app.clone(), "one".into())
        .unwrap_err()
        .contains("Unable to list audit queue results"));
    assert!(load_project_audit_queue(app.clone(), "one".into())
        .unwrap_err()
        .contains("Unable to read audit queue"));
    assert!(save_project_audit_queue(app, "one".into(), json!({}))
        .unwrap_err()
        .contains("Unable to create audit queue directory"));
}
