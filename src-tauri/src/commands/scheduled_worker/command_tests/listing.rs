use super::*;

#[test]
fn listing_sorts_truncates_and_ignores_unrelated_files() {
    let app = fixture();
    assert!(list_scheduled_executions(app.handle(), "project-1".into())
        .unwrap()
        .is_empty());
    for index in 0..25 {
        let mut value = handoff(&format!("job-{index}"), false);
        value.completed_at = format!("2026-09-25T03:{index:02}:00Z");
        store(&app, &value);
    }
    let directory = app.project("project-1");
    for name in ["unrelated.json", "scheduled_execution_ignore.txt"] {
        fs::write(directory.join(name), b"not json").unwrap();
    }
    let values = list_scheduled_executions(app.handle(), "project-1".into()).unwrap();
    assert_eq!(values.len(), 20);
    assert_eq!(values.first().unwrap().schedule_id, "job-24");
    assert_eq!(values.last().unwrap().schedule_id, "job-5");
    assert!(values.iter().all(|value| value.result.is_none()));
}

#[test]
fn listing_attaches_success_results_and_rejects_corrupt_metadata() {
    let app = fixture();
    store(&app, &handoff("job", true));
    let result = result_path(&app.handle(), "project-1", "job").unwrap();
    fs::write(result, br#"{"pages":3}"#).unwrap();
    let values = list_scheduled_executions(app.handle(), "project-1".into()).unwrap();
    assert_eq!(values.len(), 1);
    assert_eq!(values[0].result, Some(json!({"pages":3})));
    let metadata = execution_path(&app.handle(), "project-1", "job").unwrap();
    fs::write(metadata, b"not json").unwrap();
    assert!(list_scheduled_executions(app.handle(), "project-1".into())
        .unwrap_err()
        .contains("invalid"));
    assert!(list_scheduled_executions(app.handle(), "../escape".into()).is_err());
}

#[test]
fn listing_rejects_directory_io_errors_and_missing_result_is_not_invented() {
    let app = fixture();
    let directory = app.project("project-1");
    fs::create_dir_all(directory.parent().unwrap()).unwrap();
    fs::write(&directory, b"not a directory").unwrap();
    assert!(list_scheduled_executions(app.handle(), "project-1".into())
        .unwrap_err()
        .contains("Unable to list"));
    fs::remove_file(&directory).unwrap();
    store(&app, &handoff("job", true));
    let values = list_scheduled_executions(app.handle(), "project-1".into()).unwrap();
    assert_eq!(values.len(), 1);
    assert!(values[0].result.is_none());
}

#[test]
fn listing_rejects_invalid_handoff_identifiers_and_corrupt_successful_results() {
    let app = fixture();
    let mut value = handoff("job", true);
    store(&app, &value);
    let result = result_path(&app.handle(), "project-1", "job").unwrap();
    fs::write(result, b"invalid").unwrap();
    assert!(list_scheduled_executions(app.handle(), "project-1".into()).is_err());
    value.schedule_id = "../escape".into();
    let metadata = execution_path(&app.handle(), "project-1", "job").unwrap();
    fs::write(metadata, serde_json::to_vec(&value).unwrap()).unwrap();
    assert_eq!(
        list_scheduled_executions(app.handle(), "project-1".into()).unwrap_err(),
        "Invalid project or schedule identifier."
    );
}

#[cfg(unix)]
#[test]
fn listing_ignores_disappeared_metadata() {
    use std::os::unix::fs::symlink;
    let app = fixture();
    let directory = app.project("project-1");
    fs::create_dir_all(&directory).unwrap();
    symlink(
        directory.join("absent.json"),
        directory.join("scheduled_execution_gone.json"),
    )
    .unwrap();
    assert!(list_scheduled_executions(app.handle(), "project-1".into())
        .unwrap()
        .is_empty());
}

#[cfg(target_os = "linux")]
#[test]
fn listing_ignores_non_utf8_filenames_on_supported_filesystems() {
    use std::os::unix::ffi::OsStringExt;
    let app = fixture();
    let directory = app.project("project-1");
    fs::create_dir_all(&directory).unwrap();
    let invalid_name = std::ffi::OsString::from_vec(vec![0xff, 0xfe]);
    fs::write(directory.join(invalid_name), b"ignored").unwrap();
    assert!(list_scheduled_executions(app.handle(), "project-1".into())
        .unwrap()
        .is_empty());
}
