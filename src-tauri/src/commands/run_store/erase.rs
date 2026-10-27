use rusqlite::{params, Connection, OptionalExtension};
use std::{thread, time::Duration};

use super::report::{log, ErasureReport};
use super::shred::db;

pub(super) fn flush(conn: &Connection) -> Result<(), String> {
    const ATTEMPTS: usize = 3;

    for attempt in 0..ATTEMPTS {
        let busy: i64 = conn
            .query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |row| row.get(0))
            .map_err(db)?;
        if busy == 0 {
            return Ok(());
        }
        if attempt + 1 < ATTEMPTS {
            thread::sleep(Duration::from_millis(10));
        }
    }
    Err("SQLite WAL checkpoint is busy; retry after active readers finish.".into())
}

/// Right to be forgotten: rotate (destroy) the subject key, delete the
/// subject's records and tagged runs, zero freed pages, write an audit row.
pub fn forget_subject(
    conn: &mut Connection,
    project: &str,
    subject: &str,
) -> Result<ErasureReport, String> {
    let tx = conn.transaction().map_err(db)?;
    let key_id: String = tx
        .query_row(
            "SELECT key_id FROM subject_keys WHERE project_id = ?1 AND subject_id = ?2",
            params![project, subject],
            |row| row.get(0),
        )
        .optional()
        .map_err(db)?
        .unwrap_or_default();
    tx.execute(
        "UPDATE subject_keys SET key = zeroblob(32) WHERE project_id = ?1 AND subject_id = ?2",
        params![project, subject],
    )
    .map_err(db)?;
    tx.execute(
        "DELETE FROM subject_keys WHERE project_id = ?1 AND subject_id = ?2",
        params![project, subject],
    )
    .map_err(db)?;
    let records = tx
        .execute(
            "DELETE FROM records WHERE project_id = ?1 AND subject_id = ?2",
            params![project, subject],
        )
        .map_err(db)?;
    let runs = tx
        .execute("DELETE FROM crawl_runs WHERE project_id = ?1 AND json_extract(meta, '$.subjectId') = ?2", params![project, subject])
        .map_err(db)?;
    let report = log(
        &tx,
        project,
        subject,
        "forget_subject",
        &key_id,
        (records as i64, runs as i64),
    )?;
    tx.commit().map_err(db)?;
    flush(conn)?;
    Ok(report)
}

/// Full project wipe: every run, record and key of the project.
pub fn erase_project(conn: &mut Connection, project: &str) -> Result<ErasureReport, String> {
    let tx = conn.transaction().map_err(db)?;
    tx.execute(
        "UPDATE subject_keys SET key = zeroblob(32) WHERE project_id = ?1",
        [project],
    )
    .map_err(db)?;
    tx.execute("DELETE FROM subject_keys WHERE project_id = ?1", [project])
        .map_err(db)?;
    let records = tx
        .execute("DELETE FROM records WHERE project_id = ?1", [project])
        .map_err(db)?;
    let runs = tx
        .execute("DELETE FROM crawl_runs WHERE project_id = ?1", [project])
        .map_err(db)?;
    tx.execute("DELETE FROM import_log WHERE project_id = ?1", [project])
        .map_err(db)?;
    let report = log(
        &tx,
        project,
        "",
        "erase_project",
        "",
        (records as i64, runs as i64),
    )?;
    tx.commit().map_err(db)?;
    flush(conn)?;
    Ok(report)
}
