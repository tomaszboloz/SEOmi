use rusqlite::{Connection, Result, TransactionBehavior};
use std::{path::Path, time::Duration};

pub const SCHEMA_VERSION: i64 = 2;
const SQLITE_BUSY_TIMEOUT: Duration = Duration::from_secs(2);

const V1: &str = "
CREATE TABLE crawl_runs (
    run_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    start_url TEXT NOT NULL,
    meta TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    PRIMARY KEY (project_id, run_id)
);
CREATE TABLE crawl_pages (
    project_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    url TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (project_id, run_id, idx),
    FOREIGN KEY (project_id, run_id) REFERENCES crawl_runs (project_id, run_id) ON DELETE CASCADE
);
CREATE TABLE records (
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    rec_key TEXT NOT NULL,
    subject_id TEXT NOT NULL DEFAULT '',
    key_id TEXT NOT NULL DEFAULT '',
    data BLOB NOT NULL,
    PRIMARY KEY (project_id, kind, rec_key)
);
CREATE INDEX records_subject ON records (project_id, subject_id);
CREATE TABLE import_log (
    project_id TEXT NOT NULL,
    source TEXT NOT NULL,
    run_id TEXT NOT NULL,
    PRIMARY KEY (project_id, source, run_id)
);
";

const V2: &str = "
CREATE TABLE subject_keys (
    key_id TEXT NOT NULL PRIMARY KEY,
    project_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    key BLOB NOT NULL,
    UNIQUE (project_id, subject_id)
);
CREATE TABLE erasure_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    action TEXT NOT NULL,
    key_id TEXT NOT NULL,
    records_deleted INTEGER NOT NULL,
    runs_deleted INTEGER NOT NULL,
    at_ms INTEGER NOT NULL
);
";

/// Apply pending migrations atomically: a crash mid-migration rolls back and
/// the next open retries from the previous `user_version`.
pub fn migrate(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let current: i64 = tx.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if current >= SCHEMA_VERSION {
        return tx.commit();
    }
    if current < 1 {
        tx.execute_batch(V1)?;
    }
    if current < 2 {
        tx.execute_batch(V2)?;
    }
    tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    tx.commit()
}

fn configure(conn: &mut Connection, wal: bool) -> Result<()> {
    conn.busy_timeout(SQLITE_BUSY_TIMEOUT)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.pragma_update(None, "secure_delete", true)?;
    if wal {
        conn.pragma_update(None, "journal_mode", "WAL")?;
    }
    Ok(())
}

pub fn open(path: &Path) -> Result<Connection> {
    let mut conn = Connection::open(path)?;
    configure(&mut conn, true)?;
    migrate(&mut conn)?;
    Ok(conn)
}

pub fn open_memory() -> Result<Connection> {
    let mut conn = Connection::open_in_memory()?;
    configure(&mut conn, false)?;
    migrate(&mut conn)?;
    Ok(conn)
}
