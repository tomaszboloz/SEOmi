use serde_json::json;

use crate::commands::run_store::{events::load_events, schema};
use crate::commands::site_crawler::models::CrawledPageSummary;
use crate::commands::site_crawler::orchestration::native_collector::NativeCrawlCollector;

fn page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 10, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 10, "schema_types": [],
        "schema_syntax_errors": 0, "hreflangs": [], "h1_count": 1,
        "heading_counts": [1, 0, 0, 0, 0, 0], "internal_link_count": 0,
        "external_link_count": 0, "links": [], "images": [], "issues_count": 0, "issues": []
    }))
    .unwrap()
}

#[test]
fn live_pages_survive_reopen_before_terminal_event() {
    let path = std::env::temp_dir().join(format!("seomi-event-{}.sqlite3", uuid::Uuid::new_v4()));
    let conn = schema::open(&path).unwrap();
    let mut collector =
        NativeCrawlCollector::new(Some("project-live".into()), "run-live".into(), Some(conn))
            .unwrap();
    collector
        .record_started("https://example.test/", &json!({ "maxPages": 3 }))
        .unwrap();
    collector
        .record_page(&page("https://example.test/one"))
        .unwrap();
    collector
        .record_page(&page("https://example.test/two"))
        .unwrap();
    drop(collector);

    let conn = schema::open(&path).unwrap();
    let in_flight = load_events(&conn, "project-live", "run-live", 1, 10).unwrap();
    assert_eq!(in_flight.len(), 3);
    assert_eq!(in_flight[1].payload["runId"], "run-live");
    assert_eq!(in_flight[1].payload["provenance"], "live-crawl");
    assert!(in_flight
        .iter()
        .all(|event| event.event_type != "crawl:completed"));

    let mut resumed =
        NativeCrawlCollector::new(Some("project-live".into()), "run-live".into(), Some(conn))
            .unwrap();
    assert_eq!(resumed.seq, 3);
    resumed
        .record_completed("https://example.test/", 2, 91.0, 120)
        .unwrap();
    let conn = schema::open(&path).unwrap();
    let complete = load_events(&conn, "project-live", "run-live", 1, 10).unwrap();
    assert_eq!(complete.len(), 4);
    assert_eq!(complete[3].event_type, "crawl:completed");
    assert_eq!(complete[3].payload["pageCount"], 2);
    let _ = std::fs::remove_file(path);
}

#[test]
fn write_error_does_not_advance_sequence_and_interrupted_is_terminal() {
    let path = std::env::temp_dir().join(format!("seomi-event-{}.sqlite3", uuid::Uuid::new_v4()));
    let conn = schema::open(&path).unwrap();
    let mut collector =
        NativeCrawlCollector::new(Some("project-error".into()), "run-error".into(), Some(conn))
            .unwrap();
    collector
        .conn
        .as_ref()
        .unwrap()
        .execute_batch("PRAGMA query_only = ON")
        .unwrap();
    assert!(collector
        .record_started("https://example.test/", &json!({}))
        .is_err());
    assert_eq!(collector.seq, 0);
    collector
        .conn
        .as_ref()
        .unwrap()
        .execute_batch("PRAGMA query_only = OFF")
        .unwrap();
    collector
        .record_started("https://example.test/", &json!({}))
        .unwrap();
    collector
        .record_interrupted("https://example.test/", 0, "collector write failed")
        .unwrap();
    let conn = schema::open(&path).unwrap();
    let events = load_events(&conn, "project-error", "run-error", 1, 10).unwrap();
    assert_eq!(events.len(), 2);
    assert_eq!(events[1].event_type, "crawl:interrupted");
    assert_eq!(events[1].payload["interrupted"], true);
    let _ = std::fs::remove_file(path);
}
