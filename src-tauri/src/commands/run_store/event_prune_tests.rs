use super::{append, load, open_runs, StoredEvent};
use crate::commands::run_store::{erase, runs, schema};
use serde_json::{json, Value};

fn event(seq: i64, kind: &str, payload: Value) -> StoredEvent {
    StoredEvent {
        seq,
        kind: kind.into(),
        at_ms: seq * 10,
        payload,
    }
}

#[test]
fn new_run_prunes_finished_logs_and_erasure_removes_events() {
    let mut conn = schema::open_memory().unwrap();
    append(&mut conn, "p", "done", &event(1, "started", Value::Null)).unwrap();
    append(&mut conn, "p", "done", &event(2, "cancelled", Value::Null)).unwrap();
    append(&mut conn, "p", "crashed", &event(1, "started", Value::Null)).unwrap();
    append(&mut conn, "p", "next", &event(1, "started", Value::Null)).unwrap();
    assert!(load(&conn, "p", "done", 0, 5).unwrap().events.is_empty());
    assert_eq!(
        load(&conn, "p", "crashed", 0, 5).unwrap().events.len(),
        1,
        "open logs survive"
    );
    runs::save_run(&mut conn, "p", &json!({ "id": "next", "completedAt": "2026-01-01T00:00:00Z", "startUrl": "https://a.test/", "result": { "pages": [] } })).unwrap();
    runs::delete_run(&conn, "p", "next").unwrap();
    assert!(
        load(&conn, "p", "next", 0, 5).unwrap().events.is_empty(),
        "deleting a run deletes its log"
    );
    erase::erase_project(&mut conn, "p").unwrap();
    assert!(open_runs(&conn, "p").unwrap().is_empty());
}

#[test]
fn unreadable_payload_loads_as_null_instead_of_failing_the_page() {
    let mut conn = schema::open_memory().unwrap();
    append(&mut conn, "p", "r", &event(1, "started", Value::Null)).unwrap();
    conn.execute(
        "UPDATE crawl_events SET payload = '{broken' WHERE run_id = 'r'",
        [],
    )
    .unwrap();
    assert_eq!(
        load(&conn, "p", "r", 0, 5).unwrap().events[0].payload,
        Value::Null
    );
}
