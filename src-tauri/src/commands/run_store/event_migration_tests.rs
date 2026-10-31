use super::schema;
use rusqlite::Connection;

#[test]
fn v2_database_gains_event_log_and_keeps_existing_rows() {
    let dir = std::env::temp_dir().join(format!("seomi-evmig-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("s.sqlite3");
    {
        let mut conn = Connection::open(&path).unwrap();
        conn.pragma_update(None, "user_version", 0).unwrap();
        schema::migrate(&mut conn).unwrap();
        conn.execute_batch(
            "DROP TRIGGER crawl_runs_delete_events; DROP TABLE crawl_events;
             INSERT INTO crawl_runs VALUES ('r1','p1','t','u','{}',0);
             PRAGMA user_version = 2;",
        )
        .unwrap();
    }
    let conn = schema::open(&path).unwrap();
    conn.execute(
        "INSERT INTO crawl_events VALUES ('p1','r1',1,'started',0,'{}')",
        [],
    )
    .unwrap();
    conn.execute("DELETE FROM crawl_runs WHERE run_id = 'r1'", [])
        .unwrap();
    let events: i64 = conn
        .query_row("SELECT COUNT(*) FROM crawl_events", [], |r| r.get(0))
        .unwrap();
    assert_eq!(events, 0);
    drop(conn);
    std::fs::remove_dir_all(dir).unwrap();
}
