use super::{erase_commands::store_erase_project, records, runs, schema, shred};
use crate::utils::test_app::StorageApp;
use rusqlite::Error;
use serde_json::{json, Value};
use std::fs;
use std::time::{Duration, Instant};

fn run(id: &str) -> Value {
    json!({
        "id": id,
        "completedAt": "2026-10-23T00:00:00Z",
        "startUrl": "https://example.test/",
        "result": {"pages": [{"url": format!("https://example.test/{id}")}]}
    })
}

#[test]
fn validation_rejects_each_missing_snapshot_field_and_bad_page_url() {
    let cases = [
        json!({"completedAt":"now","startUrl":"u","result":{"pages":[]}}),
        json!({"id":"r","completedAt":"","startUrl":"u","result":{"pages":[]}}),
        json!({"id":"r","completedAt":"now","startUrl":"","result":{"pages":[]}}),
        json!({"id":"r","completedAt":"now","startUrl":"u"}),
        json!({"id":"r","completedAt":"now","startUrl":"u","result":{"pages":{}}}),
        json!({"id":"r","completedAt":"now","startUrl":"u","result":{"pages":[{}]}}),
    ];
    for value in cases {
        assert!(runs::save_run(&mut schema::open_memory().unwrap(), "p", &value).is_err());
    }
    assert!(runs::save_run(
        &mut schema::open_memory().unwrap(),
        "p",
        &json!({"id":" ","completedAt":"now","startUrl":"u","result":{"pages":[]}})
    )
    .is_err());
}
#[test]
fn load_after_meta_error_returns_without_publishing_partial_snapshot() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p", &run("r")).unwrap();
    let error =
        runs::load_run_after_meta(&conn, "p", "r", || Err(Error::InvalidQuery)).unwrap_err();
    assert!(matches!(error, Error::InvalidQuery));
    assert_eq!(runs::load_run(&conn, "p", "r").unwrap(), Some(run("r")));
}
#[test]
fn schema_migrates_an_existing_v1_database_to_v2() {
    let mut conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE crawl_runs (run_id TEXT, project_id TEXT, completed_at TEXT, start_url TEXT, meta TEXT, page_count INTEGER, PRIMARY KEY(project_id, run_id));
         CREATE TABLE crawl_pages (project_id TEXT, run_id TEXT, idx INTEGER, url TEXT, data TEXT, PRIMARY KEY(project_id, run_id, idx));
         CREATE TABLE records (project_id TEXT, kind TEXT, rec_key TEXT, subject_id TEXT DEFAULT '', key_id TEXT DEFAULT '', data BLOB, PRIMARY KEY(project_id, kind, rec_key));
         CREATE TABLE import_log (project_id TEXT, source TEXT, run_id TEXT, PRIMARY KEY(project_id, source, run_id));
         PRAGMA user_version = 1;",
    )
    .unwrap();
    schema::migrate(&mut conn).unwrap();
    assert_eq!(
        conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        schema::SCHEMA_VERSION
    );
    let key_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM subject_keys", [], |row| row.get(0))
        .unwrap();
    assert_eq!(key_count, 0);
}

#[test]
fn legacy_import_handles_empty_seen_and_existing_rows() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p", &run("existing")).unwrap();
    let values = [json!({}), run("existing"), run("fresh")];
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p", "coverage100", &values).unwrap(),
        1
    );
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p", "coverage100", &values).unwrap(),
        0
    );
}

#[test]
fn schema_migrates_a_fresh_v0_database() {
    let mut conn = rusqlite::Connection::open_in_memory().unwrap();
    schema::migrate(&mut conn).unwrap();
    assert_eq!(
        conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        schema::SCHEMA_VERSION
    );
}

#[test]
fn schema_wal_switch_reports_a_persistent_busy_writer() {
    let dir = std::env::temp_dir().join(format!("seomi-wal-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&dir).unwrap();
    let path = dir.join("store.sqlite3");
    let holder = rusqlite::Connection::open(&path).unwrap();
    holder
        .execute_batch("CREATE TABLE marker (id INTEGER); BEGIN IMMEDIATE;")
        .unwrap();
    let started = Instant::now();
    let error = match schema::open(&path) {
        Ok(conn) => {
            drop(conn);
            holder
                .execute_batch("ROLLBACK; DROP TABLE marker;")
                .unwrap();
            drop(holder);
            fs::remove_dir_all(&dir).unwrap();
            panic!("persistent writer lock must block WAL switching")
        }
        Err(error) => error,
    };
    assert!(started.elapsed() >= Duration::from_millis(1000));
    assert!(matches!(
        error,
        rusqlite::Error::SqliteFailure(error, _)
            if error.code == rusqlite::ErrorCode::DatabaseBusy
    ));
    holder
        .execute_batch("ROLLBACK; DROP TABLE marker;")
        .unwrap();
    drop(holder);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn legacy_cleanup_preserves_the_first_error_when_both_removals_fail() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    let project = fixture.project("p");
    fs::create_dir_all(&project).unwrap();
    fs::create_dir(project.join("crawl_runs.json")).unwrap();
    fs::create_dir(project.join("crawl_runs.json.bak")).unwrap();
    let error = store_erase_project(fixture.handle(), "p".into()).unwrap_err();
    assert!(error.contains("legacy crawl history"));
}

#[test]
fn encrypted_read_returns_none_when_key_id_no_longer_exists() {
    let conn = schema::open_memory().unwrap();
    shred::put_encrypted(&conn, "p", "kind", "record", "subject", b"secret").unwrap();
    conn.execute("DELETE FROM subject_keys", []).unwrap();
    assert_eq!(
        shred::read_record(&conn, "p", "kind", "record").unwrap(),
        None
    );
}
