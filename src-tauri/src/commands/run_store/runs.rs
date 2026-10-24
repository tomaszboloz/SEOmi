pub use super::write::{replace_runs, save_run};
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde_json::{json, Value};

fn decode_json(raw: &str) -> Result<Value> {
    serde_json::from_str(raw).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
    })
}

/// Run metadata without pages, newest first; `pageCount` carries the real total.
pub fn list_runs(conn: &Connection, project_id: &str) -> Result<Vec<Value>> {
    let mut stmt = conn.prepare(
        "SELECT meta, page_count FROM crawl_runs WHERE project_id = ?1 ORDER BY completed_at DESC",
    )?;
    let rows = stmt.query_map([project_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;
    rows.map(|row| {
        let (meta, count) = row?;
        let mut value = decode_json(&meta)?;
        if !value.is_object() {
            return Err(rusqlite::Error::InvalidQuery);
        }
        value["pageCount"] = json!(count);
        Ok(value)
    })
    .collect()
}

fn pages_query(
    conn: &Connection,
    project_id: &str,
    run_id: &str,
    offset: i64,
    limit: i64,
) -> Result<Vec<Value>> {
    let mut stmt = conn.prepare(
        "SELECT data FROM crawl_pages WHERE project_id = ?1 AND run_id = ?2 ORDER BY idx LIMIT ?3 OFFSET ?4",
    )?;
    let rows = stmt.query_map(params![project_id, run_id, limit, offset], |row| {
        row.get::<_, String>(0)
    })?;
    rows.map(|row| decode_json(&row?)).collect()
}

/// One page slice (offset/limit, limit capped at 5000) for lazy loading.
pub fn load_pages(
    conn: &Connection,
    project_id: &str,
    run_id: &str,
    offset: i64,
    limit: i64,
) -> Result<Vec<Value>> {
    pages_query(
        conn,
        project_id,
        run_id,
        offset.max(0),
        limit.clamp(0, 5000),
    )
}

/// Fully reassembled run (every page), or None.
fn load_run_snapshot<F>(
    conn: &Connection,
    project_id: &str,
    run_id: &str,
    after_meta: F,
) -> Result<Option<Value>>
where
    F: FnOnce() -> Result<()>,
{
    let tx = conn.unchecked_transaction()?;
    let meta: Option<String> = tx
        .query_row(
            "SELECT meta FROM crawl_runs WHERE project_id = ?1 AND run_id = ?2",
            params![project_id, run_id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(meta) = meta else {
        tx.commit()?;
        return Ok(None);
    };
    let mut run = decode_json(&meta)?;
    if !run.get("result").is_some_and(Value::is_object) {
        return Err(rusqlite::Error::InvalidQuery);
    }
    after_meta()?;
    run["result"]["pages"] = Value::Array(pages_query(&tx, project_id, run_id, 0, -1)?);
    tx.commit()?;
    Ok(Some(run))
}

pub fn load_run(conn: &Connection, project_id: &str, run_id: &str) -> Result<Option<Value>> {
    load_run_snapshot(conn, project_id, run_id, || Ok(()))
}

#[cfg(test)]
pub(crate) fn load_run_after_meta<F>(
    conn: &Connection,
    project_id: &str,
    run_id: &str,
    after_meta: F,
) -> Result<Option<Value>>
where
    F: FnOnce() -> Result<()>,
{
    load_run_snapshot(conn, project_id, run_id, after_meta)
}

pub fn delete_run(conn: &Connection, project_id: &str, run_id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM crawl_runs WHERE project_id = ?1 AND run_id = ?2",
        params![project_id, run_id],
    )
}
