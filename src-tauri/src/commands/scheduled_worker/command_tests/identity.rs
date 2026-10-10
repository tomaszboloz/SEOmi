use super::*;

fn store_at(app: &StorageApp, file_schedule_id: &str, value: &ScheduledExecutionHandoff) {
    let path = execution_path(&app.handle(), "project-1", file_schedule_id).unwrap();
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, serde_json::to_vec(value).unwrap()).unwrap();
}

#[test]
fn load_rejects_handoff_schedule_or_project_mismatch() {
    let app = fixture();
    let mut value = handoff("job", true);
    value.schedule_id = "other".into();
    store_at(&app, "job", &value);
    assert_eq!(
        load_scheduled_execution(app.handle(), "project-1".into(), "job".into()).unwrap_err(),
        "Scheduled execution handoff does not match its storage path."
    );

    let mut value = handoff("job", false);
    value.project_id = "project-2".into();
    store_at(&app, "job", &value);
    assert_eq!(
        load_scheduled_execution(app.handle(), "project-1".into(), "job".into()).unwrap_err(),
        "Scheduled execution handoff does not match its storage path."
    );
}

#[test]
fn listing_rejects_handoff_mismatch_with_filename_or_project() {
    let app = fixture();
    let value = handoff("other", false);
    store_at(&app, "job", &value);
    assert_eq!(
        list_scheduled_executions(app.handle(), "project-1".into()).unwrap_err(),
        "Scheduled execution handoff does not match its storage path."
    );

    let app = fixture();
    let mut value = handoff("job", false);
    value.project_id = "project-2".into();
    store_at(&app, "job", &value);
    assert_eq!(
        list_scheduled_executions(app.handle(), "project-1".into()).unwrap_err(),
        "Scheduled execution handoff does not match its storage path."
    );
}

#[test]
fn listing_rejects_an_empty_schedule_id_in_the_filename() {
    let app = fixture();
    let path = app.project("project-1").join("scheduled_execution_.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, serde_json::to_vec(&handoff("job", false)).unwrap()).unwrap();
    assert_eq!(
        list_scheduled_executions(app.handle(), "project-1".into()).unwrap_err(),
        "Invalid project or schedule identifier."
    );
}
