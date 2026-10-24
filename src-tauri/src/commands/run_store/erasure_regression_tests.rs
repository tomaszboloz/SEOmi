use super::{erase, erase_commands::store_erase_project, runs, schema};
use crate::utils::test_app::StorageApp;
use serde_json::{json, Value};
use std::{fs, path::PathBuf};

fn run(id: &str) -> Value {
    json!({"id": id, "completedAt": "2026-10-23", "startUrl": "https://example.test/",
        "result": {"pages": [{"url": format!("https://example.test/{id}")}]}})
}

#[test]
fn project_erase_removes_both_legacy_history_files() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    let app = fixture.handle();
    super::commands::store_save_crawl_run(app.clone(), "p".into(), run("old")).unwrap();
    let project = fixture.project("p");
    fs::create_dir_all(&project).unwrap();
    fs::write(project.join("crawl_runs.json"), b"legacy").unwrap();
    fs::write(project.join("crawl_runs.json.bak"), b"legacy-backup").unwrap();

    let report = store_erase_project(app.clone(), "p".into()).unwrap();
    assert_eq!(report.runs_deleted, 1);
    assert!(!project.join("crawl_runs.json").exists());
    assert!(!project.join("crawl_runs.json.bak").exists());
    assert!(super::commands::store_list_crawl_runs(app, "p".into())
        .unwrap()
        .is_empty());
}

#[test]
fn project_erase_reports_legacy_cleanup_failure() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    let app = fixture.handle();
    super::commands::store_save_crawl_run(app.clone(), "p".into(), run("old")).unwrap();
    let backup = fixture.project("p").join("crawl_runs.json.bak");
    fs::create_dir_all(&backup).unwrap();

    let error = store_erase_project(app.clone(), "p".into()).unwrap_err();
    assert!(error.contains("legacy crawl history"));
    assert!(backup.is_dir());
    assert!(super::commands::store_list_crawl_runs(app, "p".into())
        .unwrap()
        .is_empty());
}

#[test]
fn busy_wal_checkpoint_is_an_error_until_the_reader_finishes() {
    let dir = std::env::temp_dir().join(format!("seomi-erasure-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&dir).unwrap();
    let path: PathBuf = dir.join("store.sqlite3");
    let mut writer = schema::open(&path).unwrap();
    let mut reader = schema::open(&path).unwrap();
    runs::save_run(&mut writer, "p", &run("before")).unwrap();
    let reader_tx = reader.transaction().unwrap();
    let _: i64 = reader_tx
        .query_row("SELECT COUNT(*) FROM crawl_runs", [], |row| row.get(0))
        .unwrap();
    runs::save_run(&mut writer, "p", &run("after")).unwrap();

    let error = erase::erase_project(&mut writer, "p").unwrap_err();
    assert!(error.contains("WAL checkpoint is busy"));
    assert!(runs::list_runs(&writer, "p").unwrap().is_empty());
    drop(reader_tx);
    assert!(erase::flush(&writer).is_ok());
    drop(reader);
    drop(writer);
    fs::remove_dir_all(dir).unwrap();
}
