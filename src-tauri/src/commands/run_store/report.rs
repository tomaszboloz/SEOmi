use rusqlite::{params, Connection};
use serde::Serialize;

use super::shred::db;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ErasureReport {
    pub audit_id: i64,
    pub project_id: String,
    pub subject_id: String,
    pub action: String,
    pub key_id: String,
    pub records_deleted: i64,
    pub runs_deleted: i64,
    pub at_ms: i64,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as i64)
}

pub(super) fn log(
    conn: &Connection,
    project: &str,
    subject: &str,
    action: &str,
    key_id: &str,
    counts: (i64, i64),
) -> Result<ErasureReport, String> {
    let at_ms = now_ms();
    conn.execute(
        "INSERT INTO erasure_log (project_id, subject_id, action, key_id, records_deleted, runs_deleted, at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![project, subject, action, key_id, counts.0, counts.1, at_ms],
    )
    .map_err(db)?;
    Ok(ErasureReport {
        audit_id: conn.last_insert_rowid(),
        project_id: project.into(),
        subject_id: subject.into(),
        action: action.into(),
        key_id: key_id.into(),
        records_deleted: counts.0,
        runs_deleted: counts.1,
        at_ms,
    })
}

pub fn audit_log(conn: &Connection, project: &str) -> Result<Vec<ErasureReport>, String> {
    let mut stmt = conn
        .prepare("SELECT id, project_id, subject_id, action, key_id, records_deleted, runs_deleted, at_ms FROM erasure_log WHERE project_id = ?1 ORDER BY id")
        .map_err(db)?;
    let rows = stmt
        .query_map([project], |row| {
            Ok(ErasureReport {
                audit_id: row.get(0)?,
                project_id: row.get(1)?,
                subject_id: row.get(2)?,
                action: row.get(3)?,
                key_id: row.get(4)?,
                records_deleted: row.get(5)?,
                runs_deleted: row.get(6)?,
                at_ms: row.get(7)?,
            })
        })
        .map_err(db)?;
    rows.collect::<Result<_, _>>().map_err(db)
}
