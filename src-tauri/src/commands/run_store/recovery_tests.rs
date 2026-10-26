use super::{records, runs, schema};
use serde_json::json;

#[test]
fn import_journal_failure_rolls_back_the_run_and_its_pages() {
    let mut conn = schema::open_memory().unwrap();
    conn.execute_batch("CREATE TRIGGER reject_import BEFORE INSERT ON import_log BEGIN SELECT RAISE(ABORT, 'injected failure'); END;").unwrap();
    let run = json!({"id": "import", "completedAt": "2026-10-01", "startUrl": "https://example.test/",
        "result": {"pages": [{"url": "https://example.test/"}]}});
    assert!(records::import_legacy_runs(&mut conn, "p", "v1", std::slice::from_ref(&run)).is_err());
    assert!(runs::load_run(&conn, "p", "import").unwrap().is_none());
    conn.execute_batch("DROP TRIGGER reject_import").unwrap();
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p", "v1", &[run]).unwrap(),
        1
    );
}

#[test]
fn retrying_an_import_does_not_overwrite_a_newer_sqlite_run() {
    let mut conn = schema::open_memory().unwrap();
    let current = json!({"id": "same", "completedAt": "2026-10-23", "startUrl": "https://example.test/",
        "result": {"pages": [{"url": "https://example.test/new"}]}});
    runs::save_run(&mut conn, "p", &current).unwrap();
    let mut old = current.clone();
    old["result"]["pages"][0]["url"] = json!("https://example.test/stale");
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p", "v1", &[old]).unwrap(),
        0
    );
    assert_eq!(runs::load_run(&conn, "p", "same").unwrap(), Some(current));
}
