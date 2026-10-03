use super::lock::{queue_has_pending_items, queue_is_stale, stop_requested_for_run};
use super::models::{parse_snapshot, QueueItem, QueueRun, QueueSnapshot};
use chrono::{Duration as ChronoDuration, Utc};
use serde_json::json;

#[test]
fn rejects_malformed_queue_items() {
    let value = json!({
        "items": [{ "id": "item-1", "url": "", "status": "queued" }],
        "run": null
    });
    assert!(parse_snapshot(value).is_err());
}

#[test]
fn only_stale_runs_are_eligible_for_headless_resume() {
    let now = Utc::now();
    let run = QueueRun {
        id: "run-1".into(),
        status: "running".into(),
        started_at: now.to_rfc3339(),
        updated_at: (now - ChronoDuration::minutes(6)).to_rfc3339(),
        active_item_id: None,
        last_error: None,
        stop_requested: false,
        user_agent: None,
    };
    assert!(queue_is_stale(&run, now).unwrap());
}

#[test]
fn completed_items_are_not_pending() {
    let items = vec![QueueItem {
        id: "item-1".into(),
        url: "https://example.test".into(),
        status: "completed".into(),
        error: None,
        attempts: Some(1),
        updated_at: None,
        completed_at: None,
    }];
    assert!(!queue_has_pending_items(&items));
}

#[test]
fn detects_stop_request_only_for_matching_run() {
    let snapshot = QueueSnapshot {
        items: Vec::new(),
        run: Some(QueueRun {
            id: "run-1".into(),
            status: "running".into(),
            started_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            active_item_id: None,
            last_error: None,
            stop_requested: true,
            user_agent: None,
        }),
    };
    assert!(stop_requested_for_run(&snapshot, "run-1"));
    assert!(!stop_requested_for_run(&snapshot, "run-2"));
}
