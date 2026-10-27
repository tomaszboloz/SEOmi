use super::super::super::storage::task_path;
use super::super::runner::{ensure_project_directory, run_scheduled_task_with};
use super::{fixture, store, task};
use serde_json::Value;
use std::fs;

#[test]
fn directory_creation_errors_keep_the_scheduler_context() {
    let root = std::env::temp_dir().join(format!("seomi-scheduler-dir-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    let blocked = root.join("blocked");
    fs::write(&blocked, b"file").unwrap();

    let error = ensure_project_directory(&blocked.join("child")).unwrap_err();
    assert!(error.starts_with("Unable to create scheduled task directory:"));
    fs::remove_dir_all(root).unwrap();
}

#[tokio::test]
async fn final_manifest_write_errors_are_returned_after_execution() {
    let app = fixture();
    store(&app, &task("page-audit"));
    let lock = task_path(&app.handle(), "project-1", "schedule-1")
        .unwrap()
        .with_extension("json.write.lock");
    fs::remove_file(&lock).unwrap();

    let error = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            fs::remove_file(&lock).unwrap();
            fs::create_dir_all(&lock).unwrap();
            async { Ok::<Value, String>(Value::Null) }
        },
        |_, _, _, _| Ok(()),
        |_, _| Ok(()),
    )
    .await
    .unwrap_err();
    assert!(error.contains("Unable to persist scheduled data"));
}
