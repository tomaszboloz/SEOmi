use rusqlite::{params, Connection, OptionalExtension, Result};
use serde_json::Value;

use super::runs::save_run;

/// Generic keyed blob store for embeddings and history. `subject_id` and
/// `key_id` are carried per record so subject erasure can target them.
pub fn put_record(
    conn: &Connection,
    project_id: &str,
    kind: &str,
    key: &str,
    subject_id: &str,
    key_id: &str,
    data: &[u8],
) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO records VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![project_id, kind, key, subject_id, key_id, data],
    )
    .map(|_| ())
}

pub fn get_record(
    conn: &Connection,
    project_id: &str,
    kind: &str,
    key: &str,
) -> Result<Option<Vec<u8>>> {
    conn.query_row(
        "SELECT data FROM records WHERE project_id = ?1 AND kind = ?2 AND rec_key = ?3",
        params![project_id, kind, key],
        |row| row.get(0),
    )
    .optional()
}

pub fn list_record_keys(conn: &Connection, project_id: &str, kind: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT rec_key FROM records WHERE project_id = ?1 AND kind = ?2 ORDER BY rec_key",
    )?;
    let rows = stmt.query_map(params![project_id, kind], |row| row.get(0))?;
    rows.collect()
}

pub fn delete_record(conn: &Connection, project_id: &str, kind: &str, key: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM records WHERE project_id = ?1 AND kind = ?2 AND rec_key = ?3",
        params![project_id, kind, key],
    )
}

/// Idempotent localStorage import: runs already logged are skipped, so a
/// re-run after an interrupted migration only imports what is missing.
pub fn import_legacy_runs(
    conn: &mut Connection,
    project_id: &str,
    source: &str,
    runs: &[Value],
) -> Result<usize> {
    let mut imported = 0;
    for run in runs {
        let run_id = run.get("id").and_then(Value::as_str).unwrap_or("");
        let seen: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM import_log WHERE project_id = ?1 AND source = ?2 AND run_id = ?3)",
            params![project_id, source, run_id],
            |row| row.get(0),
        )?;
        if seen || run_id.is_empty() {
            continue;
        }
        save_run(conn, project_id, run)?;
        conn.execute(
            "INSERT INTO import_log VALUES (?1, ?2, ?3)",
            params![project_id, source, run_id],
        )?;
        imported += 1;
    }
    Ok(imported)
}
