use super::*;

#[test]
fn malformed_and_unreadable_checkpoint_errors_preserve_context() {
    let fixture = fixture();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(&project).unwrap();
    let path = project.join("crawl_checkpoint.json");
    fs::write(&path, b"corrupt JSON").unwrap();
    assert!(load_project_crawl_checkpoint(app.clone(), "one".into())
        .unwrap_err()
        .contains("Saved crawl checkpoint is invalid"));
    fs::File::create(&path)
        .unwrap()
        .set_len(MAX_CHECKPOINT_BYTES as u64 + 1)
        .unwrap();
    assert!(load_project_crawl_checkpoint(app.clone(), "one".into())
        .unwrap_err()
        .contains("Unable to read saved crawl checkpoint"));
    fs::remove_file(&path).unwrap();
    fs::create_dir(&path).unwrap();
    assert!(load_project_crawl_checkpoint(app.clone(), "one".into())
        .unwrap_err()
        .contains("Unable to read saved crawl checkpoint"));
    assert!(delete_project_crawl_checkpoint(app, "one".into())
        .unwrap_err()
        .contains("Unable to delete crawl checkpoint"));
}

#[test]
fn directory_destinations_report_write_failures_without_replacing_them() {
    let fixture = fixture();
    let app = fixture.handle();
    let project = fixture.project("one");
    for name in ["crawl_runs.json", "crawl_checkpoint.json"] {
        fs::create_dir_all(project.join(name)).unwrap();
    }
    assert!(
        save_project_crawl_runs(app.clone(), "one".into(), json!([]))
            .unwrap_err()
            .contains("Unable to persist saved crawl runs")
    );
    assert!(save_project_crawl_checkpoint(app, "one".into(), json!({}))
        .unwrap_err()
        .contains("Unable to persist crawl checkpoint"));
    assert!(project.join("crawl_runs.json").is_dir());
    assert!(project.join("crawl_checkpoint.json").is_dir());
}

#[test]
fn invalid_project_and_non_directory_storage_fail_without_cross_project_writes() {
    let fixture = fixture();
    let app = fixture.handle();
    assert!(
        save_project_crawl_runs(app.clone(), "../escape".into(), json!([]))
            .unwrap_err()
            .contains("Invalid project")
    );
    assert!(
        load_project_crawl_checkpoint(app.clone(), "../escape".into())
            .unwrap_err()
            .contains("Invalid project")
    );
    let project = fixture.project("one");
    fs::create_dir_all(project.parent().unwrap()).unwrap();
    fs::write(project, b"not a folder").unwrap();
    assert!(
        save_project_crawl_runs(app.clone(), "one".into(), json!([]))
            .unwrap_err()
            .contains("Unable to create project crawl folder")
    );
    assert!(save_project_crawl_checkpoint(app, "one".into(), json!({}))
        .unwrap_err()
        .contains("Unable to create project crawl folder"));
}
