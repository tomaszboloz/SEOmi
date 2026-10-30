use super::{append, close_interrupted, load, open_runs, StoredEvent};
use crate::commands::run_store::schema;
use serde_json::{json, Value};

fn event(seq: i64, kind: &str, payload: Value) -> StoredEvent {
    StoredEvent {
        seq,
        kind: kind.into(),
        at_ms: seq * 10,
        payload,
    }
}

fn page(seq: i64, url: &str) -> StoredEvent {
    event(seq, "page", json!({ "page": { "url": url } }))
}

#[test]
fn append_is_ordered_idempotent_and_rejects_gaps_conflicts_and_closed_runs() {
    let mut conn = schema::open_memory().unwrap();
    append(
        &mut conn,
        "p",
        "r1",
        &event(1, "started", json!({ "start_url": "https://a.test/" })),
    )
    .unwrap();
    append(&mut conn, "p", "r1", &page(2, "https://a.test/")).unwrap();
    append(&mut conn, "p", "r1", &page(2, "https://a.test/")).unwrap();
    let conflict = append(&mut conn, "p", "r1", &page(2, "https://a.test/other")).unwrap_err();
    assert!(conflict.contains("conflicts"), "{conflict}");
    let gap = append(&mut conn, "p", "r1", &page(4, "https://a.test/x")).unwrap_err();
    assert!(gap.contains("expected 3, got 4"), "{gap}");
    assert!(append(&mut conn, "p", "", &page(1, "x")).is_err());
    assert!(append(&mut conn, "p", "r1", &page(0, "x")).is_err());
    append(
        &mut conn,
        "p",
        "r1",
        &event(3, "completed", json!({ "pages": 1 })),
    )
    .unwrap();
    let closed = append(&mut conn, "p", "r1", &page(4, "https://a.test/late")).unwrap_err();
    assert!(closed.contains("already closed"), "{closed}");
    let all = load(&conn, "p", "r1", 0, 10).unwrap();
    assert_eq!(
        all.events.iter().map(|e| e.seq).collect::<Vec<_>>(),
        [1, 2, 3]
    );
    assert_eq!(all.events[1].payload["page"]["url"], "https://a.test/");
    assert!(!all.has_more);
}

#[test]
fn load_pages_one_pinned_run_and_open_runs_lists_interrupted_logs() {
    let mut conn = schema::open_memory().unwrap();
    append(&mut conn, "p", "old", &event(1, "started", Value::Null)).unwrap();
    append(&mut conn, "p", "old", &page(2, "https://a.test/old")).unwrap();
    append(&mut conn, "p", "live", &event(1, "started", Value::Null)).unwrap();
    for seq in 2..=6 {
        append(
            &mut conn,
            "p",
            "live",
            &page(seq, &format!("https://a.test/{seq}")),
        )
        .unwrap();
    }
    append(
        &mut conn,
        "other",
        "live",
        &event(1, "started", Value::Null),
    )
    .unwrap();
    let first = load(&conn, "p", "old", 0, 1).unwrap();
    assert_eq!((first.events.len(), first.has_more), (1, true));
    let second = load(&conn, "p", "old", first.events[0].seq, 1).unwrap();
    assert_eq!(
        second.events[0].payload["page"]["url"],
        "https://a.test/old"
    );
    assert!(
        !second.has_more,
        "a newer run never leaks into the pinned one"
    );
    assert!(load(&conn, "p", " ", 0, 1).is_err());
    assert_eq!(
        load(&conn, "p", "live", 0, 0).unwrap().events.len(),
        1,
        "limit clamps to at least 1"
    );
    let open = open_runs(&conn, "p").unwrap();
    assert_eq!(
        open.iter().map(|r| r.run_id.as_str()).collect::<Vec<_>>(),
        ["live", "old"]
    );
    assert_eq!(
        (
            open[0].last_seq,
            open[0].pages,
            open[0].started_at_ms,
            open[0].last_at_ms
        ),
        (6, 5, 10, 60)
    );
    close_interrupted(&mut conn, "p", "old", 99).unwrap();
    assert!(close_interrupted(&mut conn, "p", "old", 100)
        .unwrap_err()
        .contains("no open event log"));
    assert_eq!(
        load(&conn, "p", "old", 2, 5).unwrap().events[0].kind,
        "interrupted"
    );
    assert_eq!(open_runs(&conn, "p").unwrap().len(), 1);
}
