//! Append-only crawl event log (#138). The native crawler is the only writer and
//! owns the sequence; readers page through one explicit run, never "the latest".
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;
use serde_json::Value;

/// Events after which a run accepts no further appends.
pub const TERMINAL_KINDS: [&str; 5] = [
    "completed",
    "cancelled",
    "timed_out",
    "failed",
    "interrupted",
];
pub const MAX_PAGE: usize = 500;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StoredEvent {
    pub seq: i64,
    pub kind: String,
    pub at_ms: i64,
    pub payload: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EventPage {
    pub run_id: String,
    pub events: Vec<StoredEvent>,
    pub has_more: bool,
}

/// A run whose log has no terminal event: the app stopped while it was crawling.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OpenRun {
    pub run_id: String,
    pub last_seq: i64,
    pub pages: i64,
    pub started_at_ms: i64,
    pub last_at_ms: i64,
}

pub(super) fn terminal_sql() -> String {
    let kinds: Vec<String> = TERMINAL_KINDS.iter().map(|k| format!("'{k}'")).collect();
    kinds.join(",")
}

/// Appends `seq`; replaying an identical event is a no-op, anything else that
/// does not extend the log by exactly one is rejected with an explicit error.
pub fn append(
    conn: &mut Connection,
    project: &str,
    run: &str,
    event: &StoredEvent,
) -> Result<(), String> {
    if run.trim().is_empty() || event.seq < 1 {
        return Err("Crawl event needs a run id and a positive sequence.".into());
    }
    let db = |e: rusqlite::Error| format!("Store error: {e}");
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(db)?;
    let payload = event.payload.to_string();
    let existing: Option<(String, String)> = tx
        .query_row(
            "SELECT kind, payload FROM crawl_events WHERE project_id = ?1 AND run_id = ?2 AND seq = ?3",
            params![project, run, event.seq],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(db)?;
    if let Some((kind, stored)) = existing {
        return if kind == event.kind && stored == payload {
            Ok(())
        } else {
            Err(format!(
                "Crawl event {} of run {run} conflicts with the stored event.",
                event.seq
            ))
        };
    }
    let (last, closed): (i64, i64) = tx
        .query_row(
            &format!("SELECT COALESCE(MAX(seq), 0), COUNT(CASE WHEN kind IN ({}) THEN 1 END) FROM crawl_events WHERE project_id = ?1 AND run_id = ?2", terminal_sql()),
            params![project, run],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(db)?;
    if closed > 0 {
        return Err(format!("Crawl run {run} is already closed."));
    }
    if event.seq != last + 1 {
        return Err(format!(
            "Crawl event gap in run {run}: expected {}, got {}.",
            last + 1,
            event.seq
        ));
    }
    if event.seq == 1 {
        // A new run starts: logs of other finished runs are redundant with their saved snapshots.
        tx.execute(
            &format!("DELETE FROM crawl_events WHERE project_id = ?1 AND run_id <> ?2 AND run_id IN (SELECT run_id FROM crawl_events WHERE project_id = ?1 AND kind IN ({}))", terminal_sql()),
            params![project, run],
        )
        .map_err(db)?;
    }
    tx.execute(
        "INSERT INTO crawl_events (project_id, run_id, seq, kind, at_ms, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![project, run, event.seq, event.kind, event.at_ms, payload],
    )
    .map_err(db)?;
    tx.commit().map_err(db)
}

pub use super::event_read::{close_interrupted, load, open_runs};

#[cfg(test)]
#[path = "event_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "event_prune_tests.rs"]
mod prune_tests;
