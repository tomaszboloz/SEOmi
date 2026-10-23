use super::{records, runs, schema};
use serde_json::{json, Value};

fn run(id: &str) -> Value {
    json!({"id": id, "completedAt": "2026-10-23", "startUrl": "https://e.test/",
        "result": {"pages": [{"url": "https://e.test/page"}]}})
}

#[test]
fn invalid_snapshot_fields_never_replace_a_saved_run() {
    let mut conn = schema::open_memory().unwrap();
    let saved = run("r");
    runs::save_run(&mut conn, "p", &saved).unwrap();
    for pointer in ["/id", "/completedAt", "/startUrl", "/result/pages/0/url"] {
        for value in [Value::Null, json!(17), json!(false)] {
            let mut invalid = saved.clone();
            *invalid.pointer_mut(pointer).unwrap() = value;
            assert!(runs::save_run(&mut conn, "p", &invalid).is_err(), "{invalid}");
            assert_eq!(runs::load_run(&conn, "p", "r").unwrap(), Some(saved.clone()));
        }
    }
    for pointer in ["/id", "/completedAt", "/startUrl"] {
        let mut invalid = saved.clone();
        *invalid.pointer_mut(pointer).unwrap() = json!("");
        assert!(runs::save_run(&mut conn, "p", &invalid).is_err());
    }
    let mut invalid = saved.clone();
    invalid["id"] = json!(" \t\n");
    assert!(runs::save_run(&mut conn, "p", &invalid).is_err());
    assert_eq!(runs::load_run(&conn, "p", "r").unwrap(), Some(saved));
}

#[test]
fn empty_pages_are_valid_and_fifty_runs_is_the_inclusive_history_limit() {
    let mut conn = schema::open_memory().unwrap();
    let snapshots: Vec<_> = (0..50)
        .map(|i| {
            let mut value = run(&i.to_string());
            value["result"]["pages"] = json!([]);
            value
        })
        .collect();
    runs::replace_runs(&mut conn, "p", &snapshots).unwrap();
    assert_eq!(runs::list_runs(&conn, "p").unwrap().len(), 50);
    for expected in snapshots {
        assert_eq!(runs::load_run(&conn, "p", expected["id"].as_str().unwrap()).unwrap(), Some(expected));
    }
}

#[test]
fn page_limit_is_capped_and_out_of_range_offsets_are_empty() {
    let mut conn = schema::open_memory().unwrap();
    let mut large = run("r");
    large["result"]["pages"] = json!((0..5001).map(|i| json!({"url": format!("https://e.test/{i}")})).collect::<Vec<_>>());
    runs::save_run(&mut conn, "p", &large).unwrap();
    let pages = runs::load_pages(&conn, "p", "r", i64::MIN, i64::MAX).unwrap();
    assert_eq!(pages.len(), 5000);
    assert_eq!(pages[4999]["url"], "https://e.test/4999");
    assert_eq!(runs::load_pages(&conn, "p", "r", 5000, 1).unwrap(), vec![large["result"]["pages"][5000].clone()]);
    assert!(runs::load_pages(&conn, "p", "r", i64::MAX, 1).unwrap().is_empty());
    assert!(runs::load_pages(&conn, "other", "r", 0, 10).unwrap().is_empty());
}

#[test]
fn import_commits_each_valid_run_and_can_resume_after_a_bad_snapshot() {
    let mut conn = schema::open_memory().unwrap();
    let mut bad = run("second");
    bad["result"]["pages"][0]["url"] = Value::Null;
    assert!(records::import_legacy_runs(&mut conn, "p", "legacy", &[run("first"), bad, run("third")]).is_err());
    assert_eq!(runs::load_run(&conn, "p", "first").unwrap(), Some(run("first")));
    assert!(runs::load_run(&conn, "p", "second").unwrap().is_none());
    assert!(runs::load_run(&conn, "p", "third").unwrap().is_none());
    assert_eq!(records::import_legacy_runs(&mut conn, "p", "legacy", &[run("first"), run("second"), run("third")]).unwrap(), 2);
    let logged: i64 = conn.query_row("SELECT COUNT(*) FROM import_log", [], |row| row.get(0)).unwrap();
    assert_eq!(logged, 3);
}

#[test]
fn import_skips_missing_ids_and_journaled_runs_even_if_the_old_snapshot_is_invalid() {
    let mut conn = schema::open_memory().unwrap();
    for invalid in [json!({}), json!({"id": ""}), json!({"id": 42}), Value::Null] {
        assert_eq!(records::import_legacy_runs(&mut conn, "p", "v1", &[invalid]).unwrap(), 0);
    }
    records::import_legacy_runs(&mut conn, "p", "v1", &[run("r")]).unwrap();
    runs::delete_run(&conn, "p", "r").unwrap();
    assert_eq!(records::import_legacy_runs(&mut conn, "p", "v1", &[json!({"id": "r"})]).unwrap(), 0);
    assert!(runs::load_run(&conn, "p", "r").unwrap().is_none());
    assert_eq!(records::import_legacy_runs(&mut conn, "p", "v2", &[run("r")]).unwrap(), 1);
    assert_eq!(records::import_legacy_runs(&mut conn, "other", "v1", &[run("r")]).unwrap(), 1);
}

#[test]
fn load_run_reports_a_nested_transaction_without_ending_the_callers_transaction() {
    let mut conn = schema::open_memory().unwrap();
    runs::save_run(&mut conn, "p", &run("r")).unwrap();
    let tx = conn.transaction().unwrap();
    let error = runs::load_run(&tx, "p", "r").unwrap_err();
    assert!(error.to_string().contains("within a transaction"), "{error}");
    assert!(!tx.is_autocommit());
    tx.rollback().unwrap();
    assert_eq!(runs::load_run(&conn, "p", "r").unwrap(), Some(run("r")));
}
