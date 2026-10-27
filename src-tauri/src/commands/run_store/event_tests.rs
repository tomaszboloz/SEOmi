use serde_json::json;

use super::events::{append_events, load_events, StoredCrawlEvent};
use super::schema::open_memory;

fn event(p: &str, r: &str, seq: i64, t: &str, val: &str) -> StoredCrawlEvent {
    StoredCrawlEvent {
        project_id: p.into(),
        run_id: r.into(),
        seq,
        event_type: t.into(),
        at: "2026-10-24T12:00:00Z".into(),
        payload: json!({ "msg": val }),
    }
}

#[test]
fn test_append_and_load_events_ordering() {
    let mut conn = open_memory().unwrap();
    let evs = vec![
        event("p1", "r1", 1, "start", "init"),
        event("p1", "r1", 2, "page", "page-1"),
        event("p1", "r1", 3, "finish", "done"),
    ];
    let inserted = append_events(&mut conn, "p1", "r1", &evs).unwrap();
    assert_eq!(inserted, 3);

    let loaded = load_events(&conn, "p1", "r1", 1, 10).unwrap();
    assert_eq!(loaded.len(), 3);
    assert_eq!(loaded[0].seq, 1);
    assert_eq!(loaded[1].seq, 2);
    assert_eq!(loaded[2].seq, 3);
    assert_eq!(loaded[1].payload["msg"], "page-1");

    let paged = load_events(&conn, "p1", "r1", 2, 1).unwrap();
    assert_eq!(paged.len(), 1);
    assert_eq!(paged[0].seq, 2);
}

#[test]
fn test_append_idempotence_and_conflict() {
    let mut conn = open_memory().unwrap();
    let evs = vec![event("p1", "r1", 1, "start", "init")];
    append_events(&mut conn, "p1", "r1", &evs).unwrap();

    // Idempotent duplicate: same seq and payload
    let re_append = append_events(&mut conn, "p1", "r1", &evs).unwrap();
    assert_eq!(re_append, 0);

    // Conflict: same seq, different payload
    let conflict = vec![event("p1", "r1", 1, "start", "modified")];
    let err = append_events(&mut conn, "p1", "r1", &conflict).unwrap_err();
    assert!(err.contains("Sequence conflict"));
}

#[test]
fn test_append_sequence_gap_rejected() {
    let mut conn = open_memory().unwrap();
    let gap = vec![event("p1", "r1", 2, "page", "page-2")];
    let err = append_events(&mut conn, "p1", "r1", &gap).unwrap_err();
    assert!(err.contains("Sequence gap"));
}

#[test]
fn test_project_and_run_isolation() {
    let mut conn = open_memory().unwrap();
    append_events(&mut conn, "p1", "r1", &[event("p1", "r1", 1, "a", "1")]).unwrap();
    append_events(&mut conn, "p2", "r1", &[event("p2", "r1", 1, "b", "2")]).unwrap();
    append_events(&mut conn, "p1", "r2", &[event("p1", "r2", 1, "c", "3")]).unwrap();

    let p1_r1 = load_events(&conn, "p1", "r1", 1, 10).unwrap();
    let p2_r1 = load_events(&conn, "p2", "r1", 1, 10).unwrap();
    let p1_r2 = load_events(&conn, "p1", "r2", 1, 10).unwrap();

    assert_eq!(p1_r1[0].payload["msg"], "1");
    assert_eq!(p2_r1[0].payload["msg"], "2");
    assert_eq!(p1_r2[0].payload["msg"], "3");
}

#[test]
fn test_delete_run_cleans_events() {
    let mut conn = open_memory().unwrap();
    append_events(&mut conn, "p1", "r1", &[event("p1", "r1", 1, "a", "1")]).unwrap();
    super::runs::delete_run(&conn, "p1", "r1").unwrap();
    let loaded = load_events(&conn, "p1", "r1", 1, 10).unwrap();
    assert!(loaded.is_empty());
}

#[test]
fn test_erase_project_cleans_events() {
    let mut conn = open_memory().unwrap();
    append_events(&mut conn, "p1", "r1", &[event("p1", "r1", 1, "a", "1")]).unwrap();
    super::erase::erase_project(&mut conn, "p1").unwrap();
    let loaded = load_events(&conn, "p1", "r1", 1, 10).unwrap();
    assert!(loaded.is_empty());
}
