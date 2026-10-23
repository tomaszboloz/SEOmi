use super::{records, schema};
use rusqlite::Connection;

fn version(conn: &Connection) -> i64 {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap()
}

fn has_table(conn: &Connection, name: &str) -> bool {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        [name],
        |row| row.get(0),
    )
    .unwrap()
}

fn v1_store() -> Connection {
    let conn = schema::open_memory().unwrap();
    conn.execute_batch(
        "DROP TABLE subject_keys; DROP TABLE erasure_log; PRAGMA user_version = 1;",
    )
    .unwrap();
    records::put_record(&conn, "p", "embedding", "k", "", "", b"legacy").unwrap();
    conn
}

#[test]
fn v1_upgrade_preserves_records_and_is_repeatable() {
    let mut conn = v1_store();
    schema::migrate(&mut conn).unwrap();
    assert_eq!(version(&conn), schema::SCHEMA_VERSION);
    assert!(has_table(&conn, "subject_keys"));
    assert!(has_table(&conn, "erasure_log"));
    schema::migrate(&mut conn).unwrap();
    assert_eq!(
        records::get_record(&conn, "p", "embedding", "k").unwrap(),
        Some(b"legacy".to_vec())
    );
}

#[test]
fn failed_initial_migration_rolls_back_new_tables_and_version_before_retry() {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("CREATE TABLE subject_keys (sentinel TEXT);")
        .unwrap();
    assert!(schema::migrate(&mut conn).is_err());
    assert_eq!(version(&conn), 0);
    assert!(!has_table(&conn, "crawl_runs"));
    assert!(!has_table(&conn, "records"));
    assert!(has_table(&conn, "subject_keys"));
    assert!(conn.is_autocommit());
    conn.execute_batch("DROP TABLE subject_keys").unwrap();
    schema::migrate(&mut conn).unwrap();
    assert_eq!(version(&conn), schema::SCHEMA_VERSION);
    assert!(has_table(&conn, "crawl_runs"));
}

#[test]
fn failed_v2_upgrade_preserves_v1_data_and_rolls_back_partial_v2_ddl() {
    let mut conn = v1_store();
    conn.execute_batch("CREATE TABLE erasure_log (sentinel TEXT)")
        .unwrap();
    assert!(schema::migrate(&mut conn).is_err());
    assert_eq!(version(&conn), 1);
    assert!(!has_table(&conn, "subject_keys"));
    assert_eq!(
        records::get_record(&conn, "p", "embedding", "k").unwrap(),
        Some(b"legacy".to_vec())
    );
    conn.execute_batch("DROP TABLE erasure_log").unwrap();
    schema::migrate(&mut conn).unwrap();
    assert_eq!(version(&conn), schema::SCHEMA_VERSION);
    assert!(has_table(&conn, "subject_keys"));
}

#[test]
fn newer_schema_version_is_preserved_without_attempting_older_ddl() {
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "user_version", schema::SCHEMA_VERSION + 1)
        .unwrap();
    conn.execute_batch("CREATE TABLE future_data (value TEXT); INSERT INTO future_data VALUES ('keep');")
        .unwrap();
    schema::migrate(&mut conn).unwrap();
    assert_eq!(version(&conn), schema::SCHEMA_VERSION + 1);
    assert!(!has_table(&conn, "crawl_runs"));
    assert_eq!(
        conn.query_row("SELECT value FROM future_data", [], |row| row.get::<_, String>(0))
            .unwrap(),
        "keep"
    );
}
