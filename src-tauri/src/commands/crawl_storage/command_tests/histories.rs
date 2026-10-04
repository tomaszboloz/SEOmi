use super::*;

#[test]
fn run_commands_persist_compressed_unicode_and_keep_projects_isolated() {
    let fixture = fixture();
    let app = fixture.handle();
    assert_eq!(
        load_project_crawl_runs(app.clone(), "one".into()).unwrap(),
        json!([])
    );
    let runs = json!([{"id":"run", "url":"https://example.test/żółć", "pages":[]}]);
    save_project_crawl_runs(app.clone(), "one".into(), runs.clone()).unwrap();
    assert_eq!(
        load_project_crawl_runs(app.clone(), "one".into()).unwrap(),
        runs
    );
    assert_eq!(
        load_project_crawl_runs(app.clone(), "two".into()).unwrap(),
        json!([])
    );
    assert!(fs::read(fixture.project("one").join("crawl_runs.json"))
        .unwrap()
        .starts_with(STORAGE_MAGIC));
    save_project_crawl_runs(app.clone(), "one".into(), json!([])).unwrap();
    assert_eq!(
        load_project_crawl_runs(app, "one".into()).unwrap(),
        json!([])
    );
}

#[test]
fn backup_cleanup_failure_does_not_discard_successfully_persisted_history() {
    let fixture = fixture();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(project.join("crawl_runs.json.bak")).unwrap();
    let runs = json!([{"id":"persisted"}]);
    save_project_crawl_runs(app.clone(), "one".into(), runs.clone()).unwrap();
    assert_eq!(load_project_crawl_runs(app, "one".into()).unwrap(), runs);
    assert!(project.join("crawl_runs.json.bak").is_dir());
}

#[test]
fn run_commands_accept_fifty_and_reject_extra_or_non_array_without_replacement() {
    let fixture = fixture();
    let app = fixture.handle();
    let runs = Value::Array((0..50).map(|n| json!({"id":n})).collect());
    save_project_crawl_runs(app.clone(), "one".into(), runs.clone()).unwrap();
    assert!(
        save_project_crawl_runs(app.clone(), "one".into(), json!({}))
            .unwrap_err()
            .contains("JSON array")
    );
    assert!(save_project_crawl_runs(
        app.clone(),
        "one".into(),
        Value::Array(vec![Value::Null; 51])
    )
    .unwrap_err()
    .contains("at most 50"));
    assert_eq!(load_project_crawl_runs(app, "one".into()).unwrap(), runs);
}

#[test]
fn public_history_load_recovers_backup_and_successful_save_removes_old_backup() {
    let fixture = fixture();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(&project).unwrap();
    let path = project.join("crawl_runs.json");
    let backup = project.join("crawl_runs.json.bak");
    let recovered = json!([{"id":"backup"}]);
    fs::write(&backup, encode_crawl_runs(&recovered).unwrap()).unwrap();
    assert_eq!(
        load_project_crawl_runs(app.clone(), "one".into()).unwrap(),
        recovered
    );
    assert!(path.exists());
    assert!(!backup.exists());
    fs::write(&path, b"corrupt JSON").unwrap();
    fs::write(&backup, b"[{\"id\":\"legacy\"}]").unwrap();
    assert_eq!(
        load_project_crawl_runs(app.clone(), "one".into()).unwrap(),
        json!([{"id":"legacy"}])
    );
    fs::write(&backup, b"stale backup").unwrap();
    save_project_crawl_runs(app.clone(), "one".into(), json!([{"id":"new"}])).unwrap();
    assert!(!backup.exists());
    assert_eq!(
        load_project_crawl_runs(app, "one".into()).unwrap(),
        json!([{"id":"new"}])
    );
}
