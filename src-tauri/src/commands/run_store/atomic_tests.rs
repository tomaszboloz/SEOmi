use super::{commands::*, runs, schema};
use crate::utils::test_app::StorageApp;
use serde_json::{json, Value};

fn run(id: &str) -> Value {
    json!({"id": id, "completedAt": "2026-10-23", "startUrl": "https://example.test/",
        "result": {"pages": [{"url": format!("https://example.test/{id}")}]}})
}

#[test]
fn snapshot_page_failure_preserves_every_previous_run_and_other_projects() {
    let mut conn = schema::open_memory().unwrap();
    runs::replace_runs(&mut conn, "p", &[run("old-a"), run("old-b")]).unwrap();
    runs::save_run(&mut conn, "other", &run("other")).unwrap();
    conn.execute_batch("CREATE TRIGGER fail_page BEFORE INSERT ON crawl_pages WHEN NEW.run_id = 'bad' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;").unwrap();
    assert!(runs::replace_runs(&mut conn, "p", &[run("new"), run("bad")]).is_err());
    assert_eq!(
        runs::load_run(&conn, "p", "old-a").unwrap(),
        Some(run("old-a"))
    );
    assert_eq!(
        runs::load_run(&conn, "p", "old-b").unwrap(),
        Some(run("old-b"))
    );
    assert!(runs::load_run(&conn, "p", "new").unwrap().is_none());
    conn.execute_batch("DROP TRIGGER fail_page").unwrap();
    runs::replace_runs(&mut conn, "p", &[run("new")]).unwrap();
    assert_eq!(runs::list_runs(&conn, "p").unwrap().len(), 1);
    assert_eq!(
        runs::load_run(&conn, "other", "other").unwrap(),
        Some(run("other"))
    );
    runs::replace_runs(&mut conn, "p", &[]).unwrap();
    assert!(runs::list_runs(&conn, "p").unwrap().is_empty());
}

#[test]
fn invalid_replacements_leave_existing_history_intact() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p", &run("old")).unwrap();
    for invalid in [
        vec![run("same"), run("same")],
        vec![json!({"id": "bad"})],
        (0..51).map(|i| run(&format!("r{i}"))).collect(),
    ] {
        assert!(runs::replace_runs(&mut conn, "p", &invalid).is_err());
        assert_eq!(runs::load_run(&conn, "p", "old").unwrap(), Some(run("old")));
    }
}

#[test]
fn corrupt_json_in_metadata_or_pages_is_an_error_instead_of_null_or_panic() {
    let mut conn = schema::open_memory().unwrap();
    for raw in ["invalid", "[]", "null"] {
        runs::save_run(&mut conn, "p", &run("r")).unwrap();
        conn.execute("UPDATE crawl_runs SET meta = ?1", [raw])
            .unwrap();
        assert!(runs::list_runs(&conn, "p").is_err());
        assert!(runs::load_run(&conn, "p", "r").is_err());
    }
    runs::save_run(&mut conn, "p", &run("r")).unwrap();
    conn.execute("UPDATE crawl_pages SET data = 'invalid'", [])
        .unwrap();
    assert!(runs::load_run(&conn, "p", "r").is_err());
    assert!(runs::load_pages(&conn, "p", "r", 0, 10).is_err());
}

#[test]
fn replacement_command_validates_project_and_persists_a_complete_snapshot() {
    let fixture = StorageApp::new(tauri::test::mock_builder());
    let app = fixture.handle();
    store_replace_crawl_runs(app.clone(), "p".into(), vec![run("r")]).unwrap();
    assert_eq!(
        store_load_crawl_run(app.clone(), "p".into(), "r".into()).unwrap(),
        Some(run("r"))
    );
    assert!(store_replace_crawl_runs(app.clone(), "../x".into(), vec![]).is_err());
    assert!(store_replace_crawl_runs(app, "p".into(), vec![json!(null)]).is_err());
}

#[test]
fn ten_thousand_pages_survive_an_atomic_replacement_and_database_reopen() {
    let dir = std::env::temp_dir().join(format!("seomi-atomic-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&dir).unwrap();
    let path = dir.join("store.sqlite3");
    let mut conn = schema::open(&path).unwrap();
    let mut large = run("large");
    large["result"]["pages"] = json!((0..10_000).map(|i| json!({
        "url": format!("https://example.test/{i}"), "links": [{"target_url": "https://example.test/target"}]
    })).collect::<Vec<_>>());
    runs::replace_runs(&mut conn, "p", std::slice::from_ref(&large)).unwrap();
    drop(conn);
    let conn = schema::open(&path).unwrap();
    assert_eq!(runs::load_run(&conn, "p", "large").unwrap(), Some(large));
    assert_eq!(runs::list_runs(&conn, "p").unwrap()[0]["pageCount"], 10_000);
    assert_eq!(
        runs::load_pages(&conn, "p", "large", 9_999, 50).unwrap()[0]["url"],
        "https://example.test/9999"
    );
    drop(conn);
    std::fs::remove_dir_all(dir).unwrap();
}
