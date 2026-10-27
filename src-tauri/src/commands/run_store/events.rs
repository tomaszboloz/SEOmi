use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredCrawlEvent {
    pub project_id: String,
    pub run_id: String,
    pub seq: i64,
    pub event_type: String,
    pub at: String,
    pub payload: Value,
}
fn error(message: impl std::fmt::Display) -> String {
    format!("Crawl event store error: {message}")
}
fn decode(raw: &str) -> Result<Value, String> {
    serde_json::from_str(raw).map_err(|e| error(format!("invalid event JSON: {e}")))
}

pub fn max_seq(conn: &Connection, project: &str, run: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT coalesce(max(seq), 0) FROM crawl_events WHERE project_id = ?1 AND run_id = ?2",
        params![project, run],
        |row| row.get(0),
    )
    .map_err(error)
}
pub fn append_events(
    conn: &mut Connection,
    project: &str,
    run: &str,
    events: &[StoredCrawlEvent],
) -> Result<usize, String> {
    if project.trim().is_empty() || run.trim().is_empty() {
        return Err("Project ID and Run ID cannot be empty.".into());
    }
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(error)?;
    let mut current = max_seq(&tx, project, run)?;
    let mut inserted = 0;
    for event in events {
        if event.project_id != project || event.run_id != run {
            return Err("Event project_id or run_id does not match target.".into());
        }
        if event.event_type.trim().is_empty() || event.at.trim().is_empty() || event.seq < 1 {
            return Err("Crawl events require a type, timestamp and positive sequence.".into());
        }
        if event.seq <= current {
            let existing: Option<(String, String, String)> = tx
                .query_row(
                    "SELECT event_type, at, payload FROM crawl_events WHERE project_id = ?1 AND run_id = ?2 AND seq = ?3",
                    params![project, run, event.seq],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()
                .map_err(error)?;
            match existing {
                Some((kind, at, raw))
                    if kind == event.event_type
                        && at == event.at
                        && decode(&raw)? == event.payload =>
                {
                    continue;
                }
                _ => return Err(format!("Sequence conflict at seq {}.", event.seq)),
            }
        }
        if event.seq != current + 1 {
            return Err(format!(
                "Sequence gap: expected {}, got {}.",
                current + 1,
                event.seq
            ));
        }
        tx.execute(
            "INSERT INTO crawl_events (project_id, run_id, seq, event_type, at, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project, run, event.seq, event.event_type, event.at, event.payload.to_string()],
        )
        .map_err(error)?;
        current = event.seq;
        inserted += 1;
    }
    tx.commit().map_err(error)?;
    Ok(inserted)
}
pub fn load_events(
    conn: &Connection,
    project: &str,
    run: &str,
    from_seq: i64,
    limit: i64,
) -> Result<Vec<StoredCrawlEvent>, String> {
    if project.trim().is_empty() {
        return Err("Project ID cannot be empty.".into());
    }
    let target = if run.trim().is_empty() {
        conn.query_row(
            "SELECT run_id FROM crawl_events WHERE project_id = ?1 ORDER BY rowid DESC LIMIT 1",
            [project],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(error)?
    } else {
        Some(run.to_owned())
    };
    let Some(target) = target else {
        return Ok(Vec::new());
    };
    let mut stmt = conn
        .prepare("SELECT project_id, run_id, seq, event_type, at, payload FROM crawl_events WHERE project_id = ?1 AND run_id = ?2 AND seq >= ?3 ORDER BY seq ASC LIMIT ?4")
        .map_err(error)?;
    let rows = stmt
        .query_map(
            params![project, target, from_seq.max(1), limit.clamp(1, 10_000)],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .map_err(error)?;
    rows.map(|row| {
        let (project_id, run_id, seq, event_type, at, payload) = row.map_err(error)?;
        Ok(StoredCrawlEvent {
            project_id,
            run_id,
            seq,
            event_type,
            at,
            payload: decode(&payload)?,
        })
    })
    .collect()
}
