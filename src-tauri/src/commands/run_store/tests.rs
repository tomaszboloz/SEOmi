use super::{records, runs, schema};
use serde_json::{json, Value};

fn big_run(id: &str, pages: usize) -> Value {
    json!({
        "id": id, "completedAt": "2026-10-01T00:00:00Z", "startUrl": "https://e.test/",
        "result": { "pages_crawled": pages, "pages": (0..pages).map(|i| json!({"url": format!("https://e.test/{i}")})).collect::<Vec<_>>() }
    })
}

#[test]
fn ten_thousand_pages_round_trip_without_truncation() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p1", &big_run("r1", 10_000)).unwrap();
    let loaded = runs::load_run(&conn, "p1", "r1").unwrap().unwrap();
    assert_eq!(loaded["result"]["pages"].as_array().unwrap().len(), 10_000);
    assert_eq!(
        loaded["result"]["pages"][9_999]["url"],
        "https://e.test/9999"
    );
    let listed = runs::list_runs(&conn, "p1").unwrap();
    assert_eq!(listed[0]["pageCount"], 10_000);
    assert_eq!(listed[0]["result"]["pages"], Value::Null);
}

#[test]
fn pages_paginate_and_clamp() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p1", &big_run("r1", 30)).unwrap();
    let slice = runs::load_pages(&conn, "p1", "r1", 10, 5).unwrap();
    assert_eq!(slice.len(), 5);
    assert_eq!(slice[0]["url"], "https://e.test/10");
    assert_eq!(
        runs::load_pages(&conn, "p1", "r1", -4, 2).unwrap()[0]["url"],
        "https://e.test/0"
    );
    assert!(runs::load_pages(&conn, "p1", "r1", 0, -3)
        .unwrap()
        .is_empty());
}

#[test]
fn save_replaces_and_delete_cascades() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p1", &big_run("r1", 5)).unwrap();
    runs::save_run(&mut conn, "p1", &big_run("r1", 3)).unwrap();
    assert_eq!(
        runs::load_run(&conn, "p1", "r1").unwrap().unwrap()["result"]["pages"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    assert_eq!(runs::delete_run(&conn, "p1", "r1").unwrap(), 1);
    assert!(runs::load_run(&conn, "p1", "r1").unwrap().is_none());
    let left: i64 = conn
        .query_row("SELECT COUNT(*) FROM crawl_pages", [], |r| r.get(0))
        .unwrap();
    assert_eq!(left, 0);
}

#[test]
fn legacy_import_is_idempotent_and_resumes() {
    let mut conn = schema::open_memory().unwrap();
    let all = [big_run("a", 2), big_run("b", 2), json!({"result": {}})];
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p1", "localStorage", &all[..1]).unwrap(),
        1
    );
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p1", "localStorage", &all).unwrap(),
        1
    );
    assert_eq!(
        records::import_legacy_runs(&mut conn, "p1", "localStorage", &all).unwrap(),
        0
    );
    assert_eq!(runs::list_runs(&conn, "p1").unwrap().len(), 2);
}

#[test]
fn interrupted_migration_rolls_back_and_retries() {
    let dir = std::env::temp_dir().join(format!("seomi-store-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("s.sqlite3");
    let mut conn = rusqlite::Connection::open(&path).unwrap();
    {
        let tx = conn.transaction().unwrap();
        tx.execute_batch("CREATE TABLE crawl_runs (x INTEGER)")
            .unwrap();
        // dropped without commit == crash mid-migration
    }
    drop(conn);
    let reopened = schema::open(&path).unwrap();
    let version: i64 = reopened
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(version, schema::SCHEMA_VERSION);
    drop(reopened);
    assert_eq!(
        schema::open(&path)
            .unwrap()
            .query_row("PRAGMA user_version", [], |r| r.get(0)),
        Ok(1)
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn records_round_trip() {
    let conn = schema::open_memory().unwrap();
    records::put_record(&conn, "p1", "embedding", "k1", "subj", "key1", b"abc").unwrap();
    records::put_record(&conn, "p1", "embedding", "k0", "", "", b"z").unwrap();
    assert_eq!(
        records::get_record(&conn, "p1", "embedding", "k1")
            .unwrap()
            .unwrap(),
        b"abc"
    );
    assert_eq!(
        records::list_record_keys(&conn, "p1", "embedding").unwrap(),
        vec!["k0", "k1"]
    );
    assert_eq!(
        records::delete_record(&conn, "p1", "embedding", "k1").unwrap(),
        1
    );
    assert!(records::get_record(&conn, "p1", "embedding", "k1")
        .unwrap()
        .is_none());
}
