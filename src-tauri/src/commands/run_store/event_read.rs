//! Read side of the crawl event log (#138).
use rusqlite::{params, Connection};
use serde_json::Value;

use super::events::{append, terminal_sql, EventPage, OpenRun, StoredEvent, MAX_PAGE};

/// Events of one explicit run after `after_seq`, at most `limit` (1..=500).
pub fn load(
    conn: &Connection,
    project: &str,
    run: &str,
    after_seq: i64,
    limit: usize,
) -> Result<EventPage, String> {
    if run.trim().is_empty() {
        return Err("Loading crawl events needs an explicit run id.".into());
    }
    let limit = limit.clamp(1, MAX_PAGE);
    let db = |e: rusqlite::Error| format!("Store error: {e}");
    let mut statement = conn
        .prepare("SELECT seq, kind, at_ms, payload FROM crawl_events WHERE project_id = ?1 AND run_id = ?2 AND seq > ?3 ORDER BY seq LIMIT ?4")
        .map_err(db)?;
    let rows = statement
        .query_map(params![project, run, after_seq, limit as i64 + 1], |row| {
            let payload: String = row.get(3)?;
            Ok(StoredEvent {
                seq: row.get(0)?,
                kind: row.get(1)?,
                at_ms: row.get(2)?,
                payload: serde_json::from_str(&payload).unwrap_or(Value::Null),
            })
        })
        .map_err(db)?;
    let mut events = rows.collect::<Result<Vec<_>, _>>().map_err(db)?;
    let has_more = events.len() > limit;
    events.truncate(limit);
    Ok(EventPage {
        run_id: run.to_owned(),
        events,
        has_more,
    })
}

/// Runs without a terminal event, newest activity first.
pub fn open_runs(conn: &Connection, project: &str) -> Result<Vec<OpenRun>, String> {
    let db = |e: rusqlite::Error| format!("Store error: {e}");
    let sql = format!(
        "SELECT run_id, MAX(seq), COUNT(CASE WHEN kind = 'page' THEN 1 END), MIN(at_ms), MAX(at_ms) FROM crawl_events
         WHERE project_id = ?1 GROUP BY run_id HAVING COUNT(CASE WHEN kind IN ({}) THEN 1 END) = 0 ORDER BY MAX(at_ms) DESC, run_id",
        terminal_sql()
    );
    let mut statement = conn.prepare(&sql).map_err(db)?;
    let rows = statement
        .query_map([project], |row| {
            Ok(OpenRun {
                run_id: row.get(0)?,
                last_seq: row.get(1)?,
                pages: row.get(2)?,
                started_at_ms: row.get(3)?,
                last_at_ms: row.get(4)?,
            })
        })
        .map_err(db)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db)
}

/// Closes an orphaned log (app stopped mid-crawl) so it is no longer offered for recovery.
pub fn close_interrupted(
    conn: &mut Connection,
    project: &str,
    run: &str,
    at_ms: i64,
) -> Result<(), String> {
    let open = open_runs(conn, project)?;
    let Some(found) = open.iter().find(|candidate| candidate.run_id == run) else {
        return Err(format!("Crawl run {run} has no open event log."));
    };
    let event = StoredEvent {
        seq: found.last_seq + 1,
        kind: "interrupted".into(),
        at_ms,
        payload: Value::Null,
    };
    append(conn, project, run, &event)
}
