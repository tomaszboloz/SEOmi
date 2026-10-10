use super::*;

#[test]
fn save_persists_valid_manifest_and_rejects_invalid_input_without_overwrite() {
    let app = fixture();
    let mut task = tests::manifest();
    save_scheduled_task(app.handle(), "project-1".into(), task.clone()).unwrap();
    let path = task_path(&app.handle(), "project-1", &task.schedule_id).unwrap();
    let stored = fs::read(&path).unwrap();
    let parsed: ScheduledTaskManifest = serde_json::from_slice(&stored).unwrap();
    assert_eq!(parsed.schedule_id, task.schedule_id);
    assert_eq!(parsed.interval_hours, 24);
    task.interval_hours = 1;
    assert!(save_scheduled_task(app.handle(), "project-1".into(), task).is_err());
    assert_eq!(fs::read(path).unwrap(), stored);
    assert!(save_scheduled_task(app.handle(), "../escape".into(), tests::manifest()).is_err());
}

#[test]
fn load_preserves_failure_and_attaches_only_successful_result() {
    let app = fixture();
    assert!(
        load_scheduled_execution(app.handle(), "project-1".into(), "job".into())
            .unwrap()
            .is_none()
    );
    let mut value = handoff("job", false);
    value.error = Some("measured failure".into());
    store(&app, &value);
    let result = result_path(&app.handle(), "project-1", "job").unwrap();
    fs::write(&result, b"not json").unwrap();
    let loaded = load_scheduled_execution(app.handle(), "project-1".into(), "job".into())
        .unwrap()
        .unwrap();
    assert_eq!(loaded.error.as_deref(), Some("measured failure"));
    assert!(loaded.result.is_none());
    value.succeeded = true;
    store(&app, &value);
    assert!(load_scheduled_execution(app.handle(), "project-1".into(), "job".into()).is_err());
    fs::write(&result, br#"{"score":42}"#).unwrap();
    let loaded = load_scheduled_execution(app.handle(), "project-1".into(), "job".into())
        .unwrap()
        .unwrap();
    assert_eq!(loaded.result, Some(json!({"score":42})));
    fs::remove_file(result).unwrap();
    assert!(
        load_scheduled_execution(app.handle(), "project-1".into(), "job".into())
            .unwrap()
            .unwrap()
            .result
            .is_none()
    );
}

#[test]
fn acknowledge_removes_handoff_and_result_but_preserves_task() {
    let app = fixture();
    save_scheduled_task(app.handle(), "project-1".into(), tests::manifest()).unwrap();
    let value = handoff("schedule-1", true);
    store(&app, &value);
    let result = result_path(&app.handle(), "project-1", "schedule-1").unwrap();
    fs::write(&result, b"{}").unwrap();
    for _ in 0..2 {
        acknowledge_scheduled_execution(app.handle(), "project-1".into(), "schedule-1".into())
            .unwrap();
    }
    assert!(task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .is_file());
    assert!(!execution_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .exists());
    assert!(!result.exists());
}

#[test]
fn delete_removes_all_three_records_and_is_idempotent() {
    let app = fixture();
    save_scheduled_task(app.handle(), "project-1".into(), tests::manifest()).unwrap();
    store(&app, &handoff("schedule-1", false));
    let result = result_path(&app.handle(), "project-1", "schedule-1").unwrap();
    fs::write(&result, b"{}").unwrap();
    for _ in 0..2 {
        delete_scheduled_task(app.handle(), "project-1".into(), "schedule-1".into()).unwrap();
    }
    for path in [
        task_path(&app.handle(), "project-1", "schedule-1").unwrap(),
        execution_path(&app.handle(), "project-1", "schedule-1").unwrap(),
        result,
    ] {
        assert!(!path.exists());
    }
}

#[test]
fn command_failures_propagate_and_identifiers_cannot_escape_storage() {
    let app = fixture();
    for id in ["../escape", "", "a/b"] {
        assert!(delete_scheduled_task(app.handle(), "project-1".into(), id.into()).is_err());
        assert!(
            acknowledge_scheduled_execution(app.handle(), "project-1".into(), id.into()).is_err()
        );
        assert!(load_scheduled_execution(app.handle(), "project-1".into(), id.into()).is_err());
    }
    let task = task_path(&app.handle(), "project-1", "job").unwrap();
    fs::create_dir_all(&task).unwrap();
    assert!(
        delete_scheduled_task(app.handle(), "project-1".into(), "job".into())
            .unwrap_err()
            .contains("Unable to remove")
    );
    let execution = execution_path(&app.handle(), "project-1", "job").unwrap();
    fs::create_dir_all(&execution).unwrap();
    assert!(
        acknowledge_scheduled_execution(app.handle(), "project-1".into(), "job".into())
            .unwrap_err()
            .contains("Unable to acknowledge")
    );
    assert!(load_scheduled_execution(app.handle(), "project-1".into(), "job".into()).is_err());
}
