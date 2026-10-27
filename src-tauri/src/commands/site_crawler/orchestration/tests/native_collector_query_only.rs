use serde_json::json;

use crate::commands::run_store::events::load_events;
use crate::commands::run_store::schema;
use crate::commands::site_crawler::orchestration::native_collector::NativeCrawlCollector;

use super::native_collector_integration::dummy_page;

#[test]
fn test_collector_query_only_seq_recovery() {
    let db_dir = std::env::temp_dir().join(format!("seomi-query-only-{}", uuid::Uuid::new_v4()));
    let _ = std::fs::create_dir_all(&db_dir);
    let db_path = db_dir.join("test_store.sqlite3");
    let conn = schema::open(&db_path).expect("open connection");
    let mut collector = NativeCrawlCollector::new(
        Some("proj-query-only".into()),
        "run-seq-recovery".into(),
        Some(conn),
    );
    assert_eq!(collector.seq, 0);

    // Make database read-only
    let conn_ref = collector.conn.as_ref().unwrap();
    conn_ref.execute_batch("PRAGMA query_only = ON;").unwrap();

    // Attempt append - must fail with Err
    let err = collector.record_started("https://example.test/", &json!({}));
    assert!(err.is_err());
    // Crucial: seq must NOT have advanced!
    assert_eq!(collector.seq, 0);

    // Re-enable writes
    let conn_ref = collector.conn.as_ref().unwrap();
    conn_ref.execute_batch("PRAGMA query_only = OFF;").unwrap();

    // Retry append - must succeed with seq == 1
    collector
        .record_started("https://example.test/", &json!({}))
        .expect("retry record started must succeed");
    assert_eq!(collector.seq, 1);

    // Append next event - must have seq == 2 with no gaps
    collector
        .record_page(&dummy_page("https://example.test/p1"))
        .expect("record page");
    assert_eq!(collector.seq, 2);

    let conn2 = schema::open(&db_path).expect("open connection 2");
    let events = load_events(&conn2, "proj-query-only", "run-seq-recovery", 1, 10).unwrap();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].seq, 1);
    assert_eq!(events[1].seq, 2);

    let _ = std::fs::remove_dir_all(&db_dir);
}

#[test]
fn test_collector_inactive_graceful() {
    let mut inactive = NativeCrawlCollector::new(None, "run-inactive".into(), None);
    assert!(!inactive.is_active());
    assert!(inactive
        .record_started("https://example.test/", &json!({}))
        .is_ok());
    assert!(inactive
        .record_page(&dummy_page("https://example.test/p1"))
        .is_ok());
    assert!(inactive
        .record_completed("https://example.test/", 1, 90.0, 100)
        .is_ok());
}
