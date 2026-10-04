use super::*;

#[test]
fn public_snapshot_commands_roundtrip_and_isolate_projects() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    assert_eq!(
        load_project_audit_queue(app.clone(), "one".into()).unwrap(),
        Value::Null
    );
    assert_eq!(read_queue_snapshot(&app, "one").unwrap(), None);
    let snapshot = json!({"items": [{"url": "https://example.test/żółć"}], "run": null});
    save_project_audit_queue(app.clone(), "one".into(), snapshot.clone()).unwrap();
    assert_eq!(
        load_project_audit_queue(app.clone(), "one".into()).unwrap(),
        snapshot
    );
    assert_eq!(read_queue_snapshot(&app, "one").unwrap(), Some(snapshot));
    assert_eq!(
        load_project_audit_queue(app.clone(), "two".into()).unwrap(),
        Value::Null
    );
    assert!(
        save_project_audit_queue(app.clone(), "one".into(), json!([]))
            .unwrap_err()
            .contains("JSON object")
    );
    assert!(
        save_project_audit_queue(app.clone(), "../escape".into(), json!({}))
            .unwrap_err()
            .contains("Invalid project")
    );
    delete_project_audit_queue(app.clone(), "one".into()).unwrap();
    delete_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert_eq!(
        load_project_audit_queue(app, "one".into()).unwrap(),
        Value::Null
    );
}

#[test]
fn deleting_queue_preserves_other_projects_and_lock_or_foreign_files() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), json!({})).unwrap();
    save_project_audit_queue(app.clone(), "two".into(), json!({"retained": true})).unwrap();
    let project = fixture.project("one");
    for name in [
        "audit_queue_execution_run.json",
        "audit_queue_result_run_item.json",
        "audit_queue_execution_run.lock",
        "audit_queue_result_run_item.json.write.lock",
        "unrelated.json",
    ] {
        fs::write(project.join(name), b"{}").unwrap();
    }
    delete_project_audit_queue(app.clone(), "one".into()).unwrap();
    assert!(!project.join("audit_queue_execution_run.json").exists());
    assert!(!project.join("audit_queue_result_run_item.json").exists());
    for name in [
        "audit_queue_execution_run.lock",
        "audit_queue_result_run_item.json.write.lock",
        "unrelated.json",
    ] {
        assert!(project.join(name).exists());
    }
    assert_eq!(
        load_project_audit_queue(app, "two".into()).unwrap(),
        json!({"retained":true})
    );
}
