use serde_json::json;

use crate::commands::run_store::events::load_events;
use crate::commands::run_store::schema;
use crate::commands::site_crawler::models::CrawledPageSummary;
use crate::commands::site_crawler::orchestration::native_collector::NativeCrawlCollector;

pub fn dummy_page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 15, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 120, "schema_types": [],
        "schema_syntax_errors": 0, "hreflangs": [], "h1_count": 1,
        "heading_counts": [1, 0, 0, 0, 0, 0], "internal_link_count": 1,
        "external_link_count": 0, "links": [], "images": [], "issues_count": 0, "issues": []
    }))
    .unwrap()
}

#[test]
fn test_in_flight_page_persistence_and_reopen_replay() {
    let db_dir = std::env::temp_dir().join(format!("seomi-col-inf-{}", uuid::Uuid::new_v4()));
    let _ = std::fs::create_dir_all(&db_dir);
    let db_path = db_dir.join("test_store.sqlite3");

    let conn1 = schema::open(&db_path).expect("open connection 1");
    let mut collector = NativeCrawlCollector::new(
        Some("proj-crawl-1".into()),
        "run-live-1".into(),
        Some(conn1),
    );
    assert!(collector.is_active());

    collector
        .record_started("https://example.test/", &json!({ "maxPages": 10 }))
        .expect("record started");
    collector
        .record_page(&dummy_page("https://example.test/p1"))
        .expect("record page 1");
    collector
        .record_page(&dummy_page("https://example.test/p2"))
        .expect("record page 2");

    // Reopen second independent connection while crawl is in flight
    let conn2 = schema::open(&db_path).expect("open connection 2");
    let in_flight =
        load_events(&conn2, "proj-crawl-1", "run-live-1", 1, 10).expect("load in flight");
    assert_eq!(in_flight.len(), 3);
    assert_eq!(in_flight[0].event_type, "crawl:started");
    assert_eq!(in_flight[1].event_type, "crawl:page");
    assert_eq!(in_flight[2].event_type, "crawl:page");
    assert_eq!(in_flight[1].payload["url"], "https://example.test/p1");
    assert_eq!(in_flight[2].payload["url"], "https://example.test/p2");
    assert_eq!(in_flight[1].payload["provenance"], "live-crawl");

    // Verify incomplete run is not marked completed
    assert!(in_flight.iter().all(|e| e.event_type != "crawl:completed"));

    // Project isolation check
    let isolated =
        load_events(&conn2, "other-project", "run-live-1", 1, 10).expect("load isolated");
    assert_eq!(isolated.len(), 0);

    // Replay / empty run discovery
    let discovered = load_events(&conn2, "proj-crawl-1", "", 1, 10).expect("discover run");
    assert_eq!(discovered.len(), 3);
    assert_eq!(discovered[0].run_id, "run-live-1");

    // Complete the crawl
    collector
        .record_completed("https://example.test/", 2, 85.0, 350)
        .expect("record completed");

    let complete = load_events(&conn2, "proj-crawl-1", "run-live-1", 1, 10).expect("load complete");
    assert_eq!(complete.len(), 4);
    assert_eq!(complete[3].event_type, "crawl:completed");
    assert_eq!(complete[3].payload["pageCount"], 2);
    assert_eq!(complete[3].payload["health_score"], 85.0);
    assert_eq!(complete[3].payload["duration_ms"], 350);

    let _ = std::fs::remove_dir_all(&db_dir);
}

#[test]
fn test_collector_cancelled_and_timed_out_terminal_states() {
    let db_dir = std::env::temp_dir().join(format!("seomi-col-term-{}", uuid::Uuid::new_v4()));
    let _ = std::fs::create_dir_all(&db_dir);
    let db_path = db_dir.join("test_store.sqlite3");

    // Test cancelled terminal state
    let conn_c = schema::open(&db_path).expect("open connection");
    let mut col_c = NativeCrawlCollector::new(
        Some("proj-term".into()),
        "run-cancelled".into(),
        Some(conn_c),
    );
    col_c
        .record_started("https://example.test/", &json!({}))
        .unwrap();
    col_c
        .record_cancelled("https://example.test/", 1, 120)
        .unwrap();

    let conn_r = schema::open(&db_path).expect("open connection read");
    let events_c = load_events(&conn_r, "proj-term", "run-cancelled", 1, 10).unwrap();
    assert_eq!(events_c.len(), 2);
    assert_eq!(events_c[1].event_type, "crawl:cancelled");
    assert_eq!(events_c[1].payload["cancelled"], true);
    assert_eq!(events_c[1].payload["pageCount"], 1);
    assert_eq!(events_c[1].payload["duration_ms"], 120);

    // Test timed_out terminal state
    let conn_t = schema::open(&db_path).expect("open connection");
    let mut col_t =
        NativeCrawlCollector::new(Some("proj-term".into()), "run-timeout".into(), Some(conn_t));
    col_t
        .record_started("https://example.test/", &json!({}))
        .unwrap();
    col_t
        .record_timed_out("https://example.test/", 2, 5000)
        .unwrap();

    let events_t = load_events(&conn_r, "proj-term", "run-timeout", 1, 10).unwrap();
    assert_eq!(events_t.len(), 2);
    assert_eq!(events_t[1].event_type, "crawl:timed_out");
    assert_eq!(events_t[1].payload["timed_out"], true);
    assert_eq!(events_t[1].payload["duration_ms"], 5000);

    let _ = std::fs::remove_dir_all(&db_dir);
}
