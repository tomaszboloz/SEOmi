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

fn err(e: impl std::fmt::Display) -> String {
    format!("Event store error: {e}")
}

fn decode_json(raw: &str) -> Result<Value, String> {
    serde_json::from_str(raw).map_err(|e| err(format!("JSON decode error: {e}")))
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
        .map_err(err)?;
    let mut current_max: i64 = tx
        .query_row(
            "SELECT coalesce(max(seq), 0) FROM crawl_events WHERE project_id = ?1 AND run_id = ?2",
            params![project, run],
            |row| row.get(0),
        )
        .map_err(err)?;

    let mut inserted = 0;
    for ev in events {
        if ev.project_id != project || ev.run_id != run {
            return Err("Event project_id or run_id does not match target.".into());
        }
        if ev.seq <= current_max {
            let existing: Option<(String, String, String)> = tx
                .query_row(
                    "SELECT event_type, at, payload FROM crawl_events WHERE project_id = ?1 AND run_id = ?2 AND seq = ?3",
                    params![project, run, ev.seq],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()
                .map_err(err)?;
            if let Some((et, at, pl)) = existing {
                let existing_val = decode_json(&pl)?;
                if et == ev.event_type && at == ev.at && existing_val == ev.payload {
                    continue; // Idempotent duplicate: skip
                }
                return Err(format!(
                    "Sequence conflict at seq {} for run {}: distinct data.",
                    ev.seq, run
                ));
            }
        }
        if ev.seq != current_max + 1 {
            return Err(format!(
                "Sequence gap: expected seq {}, got {} for run {}.",
                current_max + 1,
                ev.seq,
                run
            ));
        }
        tx.execute(
            "INSERT INTO crawl_events (project_id, run_id, seq, event_type, at, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project, run, ev.seq, ev.event_type, ev.at, ev.payload.to_string()],
        )
        .map_err(err)?;
        current_max = ev.seq;
        inserted += 1;
    }
    tx.commit().map_err(err)?;
    Ok(inserted)
}

pub fn load_events(
    conn: &Connection,
    project: &str,
    run: &str,
    from_seq: i64,
    limit: i64,
) -> Result<Vec<StoredCrawlEvent>, String> {
    let capped_limit = limit.clamp(1, 10_000);
    let target_run: String = if run.trim().is_empty() {
        let q = "SELECT run_id FROM crawl_events WHERE project_id = ?1 ORDER BY rowid DESC LIMIT 1";
        match conn
            .query_row(q, params![project], |r| r.get(0))
            .optional()
            .map_err(err)?
        {
            Some(r) => r,
            None => return Ok(Vec::new()),
        }
    } else {
        run.to_string()
    };
    let mut stmt = conn
        .prepare(
            "SELECT project_id, run_id, seq, event_type, at, payload FROM crawl_events \
             WHERE project_id = ?1 AND run_id = ?2 AND seq >= ?3 \
             ORDER BY seq ASC LIMIT ?4",
        )
        .map_err(err)?;

    let rows = stmt
        .query_map(
            params![project, target_run, from_seq.max(1), capped_limit],
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
        .map_err(err)?;

    let mut result = Vec::new();
    for row in rows {
        let (p, r, s, et, at, pl) = row.map_err(err)?;
        let payload = decode_json(&pl)?;
        result.push(StoredCrawlEvent {
            project_id: p,
            run_id: r,
            seq: s,
            event_type: et,
            at,
            payload,
        });
    }
    Ok(result)
}
