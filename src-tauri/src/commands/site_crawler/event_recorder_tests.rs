use super::{terminal_kind, EventRecorder};
use crate::commands::run_store::{event_read::open_runs, events::load, schema};
use crate::commands::site_crawler::control::CrawlControl;
use serde_json::json;
use std::fs;

#[test]
fn control_records_started_pages_and_terminal_event_to_a_reopened_store() {
    let dir = std::env::temp_dir().join(format!("seomi-events-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("store.sqlite3");
    let control = CrawlControl::new();
    control.record_event("run-a", "page", &json!({ "ignored": true }));
    control.attach_recorder(
        "run-a",
        EventRecorder::new(schema::open(&path).unwrap(), "p", "run-a"),
    );
    control.record_event(
        "run-a",
        "started",
        &json!({ "start_url": "https://a.test/" }),
    );
    control.record_event(
        "run-a",
        "page",
        &json!({ "page": { "url": "https://a.test/" } }),
    );
    control.record_event("other-run", "page", &json!({}));
    // The app stops here: a reopened store still sees the open run and both events.
    let reopened = schema::open(&path).unwrap();
    let open = open_runs(&reopened, "p").unwrap();
    assert_eq!(
        (open[0].run_id.as_str(), open[0].last_seq, open[0].pages),
        ("run-a", 2, 1)
    );
    assert_eq!(control.finish_recorder("run-a", "cancelled", 1), None);
    assert_eq!(
        control.finish_recorder("run-a", "completed", 1),
        None,
        "a detached run writes nothing"
    );
    let page = load(&reopened, "p", "run-a", 0, 10).unwrap();
    assert_eq!(
        page.events
            .iter()
            .map(|e| e.kind.as_str())
            .collect::<Vec<_>>(),
        ["started", "page", "cancelled"]
    );
    assert_eq!(page.events[2].payload, json!({ "pages": 1 }));
    assert!(open_runs(&reopened, "p").unwrap().is_empty());
    drop(reopened);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn failed_write_disables_the_recorder_and_is_reported_once() {
    let conn = schema::open_memory().unwrap();
    conn.execute_batch("DROP TABLE crawl_events;").unwrap();
    let control = CrawlControl::new();
    control.attach_recorder("r", EventRecorder::new(conn, "p", "r"));
    control.record_event("r", "started", &json!({}));
    control.record_event("r", "page", &json!({}));
    let error = control.finish_recorder("r", "completed", 0).unwrap();
    assert!(error.contains("crawl_events"), "{error}");
}

#[test]
fn terminal_kind_prefers_failure_then_cancel_then_timeout() {
    assert_eq!(terminal_kind(true, true, true), "failed");
    assert_eq!(terminal_kind(true, true, false), "cancelled");
    assert_eq!(terminal_kind(false, true, false), "timed_out");
    assert_eq!(terminal_kind(false, false, false), "completed");
}
