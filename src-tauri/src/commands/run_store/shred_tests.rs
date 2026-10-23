use super::shred;
use rusqlite::Connection;

const RECORDS: &str = "CREATE TABLE records (
    project_id TEXT NOT NULL, kind TEXT NOT NULL, rec_key TEXT NOT NULL,
    subject_id TEXT NOT NULL DEFAULT '', key_id TEXT NOT NULL DEFAULT '',
    data BLOB NOT NULL, PRIMARY KEY (project_id, kind, rec_key));";
const KEYS: &str = "CREATE TABLE subject_keys (
    key_id TEXT NOT NULL PRIMARY KEY, project_id TEXT NOT NULL,
    subject_id TEXT NOT NULL, key BLOB NOT NULL, UNIQUE (project_id, subject_id));";

fn store(sql: &str) -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(sql).unwrap();
    conn
}

fn full() -> Connection {
    store(&format!("{RECORDS}{KEYS}"))
}

fn abort_on_insert(conn: &Connection, table: &str) {
    conn.execute_batch(&format!(
        "CREATE TRIGGER deny BEFORE INSERT ON {table} \
         BEGIN SELECT RAISE(ABORT, 'denied'); END;"
    ))
    .unwrap();
}

#[test]
fn missing_schema_is_reported_as_store_error() {
    let conn = store("");
    let write = shred::put_encrypted(&conn, "p", "k", "r", "s", b"x").unwrap_err();
    assert!(write.starts_with("Store error:"), "{write}");
    let read = shred::read_record(&conn, "p", "k", "r").unwrap_err();
    assert!(read.starts_with("Store error:"), "{read}");
}

#[test]
fn key_insert_and_record_write_failures_surface_the_store_error() {
    let conn = store(&format!("{RECORDS}{KEYS}"));
    abort_on_insert(&conn, "subject_keys");
    let error = shred::put_encrypted(&conn, "p", "k", "r", "s", b"x").unwrap_err();
    assert!(
        error.starts_with("Store error:") && error.contains("denied"),
        "{error}"
    );

    let conn = full();
    abort_on_insert(&conn, "records");
    let error = shred::put_encrypted(&conn, "p", "k", "r", "s", b"x").unwrap_err();
    assert!(error.contains("denied"), "{error}");
}

#[test]
fn lost_key_table_fails_read_of_encrypted_row_but_not_plain_row() {
    let conn = full();
    shred::put_encrypted(&conn, "p", "k", "enc", "s", b"secret").unwrap();
    conn.execute(
        "INSERT INTO records VALUES ('p', 'k', 'plain', '', '', x'0102')",
        [],
    )
    .unwrap();
    conn.execute_batch("DROP TABLE subject_keys").unwrap();
    let error = shred::read_record(&conn, "p", "k", "enc").unwrap_err();
    assert!(error.starts_with("Store error:"), "{error}");
    let plain = shred::read_record(&conn, "p", "k", "plain").unwrap();
    assert_eq!(plain, Some(vec![1, 2]));
}

#[test]
fn truncated_or_tampered_ciphertext_reads_as_none() {
    let conn = full();
    shred::put_encrypted(&conn, "p", "k", "r", "s", b"secret").unwrap();
    assert_eq!(
        shred::read_record(&conn, "p", "k", "r").unwrap(),
        Some(b"secret".to_vec())
    );
    conn.execute("UPDATE records SET data = x'0102030405'", [])
        .unwrap();
    assert_eq!(shred::read_record(&conn, "p", "k", "r").unwrap(), None);
    shred::put_encrypted(&conn, "p", "k", "r", "s", b"secret").unwrap();
    conn.execute("UPDATE records SET data = CAST(data || x'00' AS BLOB)", [])
        .unwrap();
    assert_eq!(shred::read_record(&conn, "p", "k", "r").unwrap(), None);
}
