use serde_json::json;

use super::events::{append_events, load_events, StoredCrawlEvent};
use super::schema::open_memory;

fn event(project: &str, run: &str, seq: i64, kind: &str, value: &str) -> StoredCrawlEvent {
    StoredCrawlEvent {
        project_id: project.into(),
        run_id: run.into(),
        seq,
        event_type: kind.into(),
        at: "2026-10-26T12:00:00Z".into(),
        payload: json!({ "value": value }),
    }
}

#[test]
fn events_are_ordered_idempotent_and_isolated() {
    let mut conn = open_memory().unwrap();
    let events = vec![
        event("p1", "r1", 1, "crawl:started", "start"),
        event("p1", "r1", 2, "crawl:page", "page"),
    ];
    assert_eq!(append_events(&mut conn, "p1", "r1", &events).unwrap(), 2);
    assert_eq!(append_events(&mut conn, "p1", "r1", &events).unwrap(), 0);
    let loaded = load_events(&conn, "p1", "r1", 1, 10).unwrap();
    assert_eq!(loaded.len(), 2);
    assert_eq!(loaded[1].payload["value"], "page");
    assert!(load_events(&conn, "p2", "r1", 1, 10).unwrap().is_empty());
}

#[test]
fn events_reject_gaps_and_conflicting_replays_atomically() {
    let mut conn = open_memory().unwrap();
    let gap = event("p1", "r1", 2, "crawl:page", "page");
    assert!(append_events(&mut conn, "p1", "r1", &[gap])
        .unwrap_err()
        .contains("gap"));
    append_events(
        &mut conn,
        "p1",
        "r1",
        &[event("p1", "r1", 1, "crawl:started", "start")],
    )
    .unwrap();
    let conflict = event("p1", "r1", 1, "crawl:started", "changed");
    assert!(append_events(&mut conn, "p1", "r1", &[conflict])
        .unwrap_err()
        .contains("conflict"));
    assert_eq!(load_events(&conn, "p1", "r1", 1, 10).unwrap().len(), 1);
}

#[test]
fn deleting_run_and_project_removes_event_log() {
    let mut conn = open_memory().unwrap();
    append_events(
        &mut conn,
        "p1",
        "r1",
        &[event("p1", "r1", 1, "crawl:started", "start")],
    )
    .unwrap();
    super::runs::delete_run(&conn, "p1", "r1").unwrap();
    assert!(load_events(&conn, "p1", "r1", 1, 10).unwrap().is_empty());
    append_events(
        &mut conn,
        "p1",
        "r2",
        &[event("p1", "r2", 1, "crawl:started", "start")],
    )
    .unwrap();
    super::erase::erase_project(&mut conn, "p1").unwrap();
    assert!(load_events(&conn, "p1", "r2", 1, 10).unwrap().is_empty());
}
