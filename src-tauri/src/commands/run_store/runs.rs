use rusqlite::{params, Connection, OptionalExtension, Result};
use serde_json::{json, Value};

fn text<'a>(run: &'a Value, key: &str) -> &'a str {
    run.get(key).and_then(Value::as_str).unwrap_or("")
}

/// Split a run into a metadata row plus one row per page. No page cap.
pub fn save_run(conn: &mut Connection, project_id: &str, run: &Value) -> Result<()> {
    let run_id = text(run, "id");
    let mut meta = run.clone();
    let pages = meta
        .pointer_mut("/result/pages")
        .map(Value::take)
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM crawl_runs WHERE project_id = ?1 AND run_id = ?2",
        params![project_id, run_id],
    )?;
    tx.execute(
        "INSERT INTO crawl_runs VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            run_id,
            project_id,
            text(run, "completedAt"),
            text(run, "startUrl"),
            meta.to_string(),
            pages.len() as i64
        ],
    )?;
    {
        let mut insert = tx.prepare("INSERT INTO crawl_pages VALUES (?1, ?2, ?3, ?4, ?5)")?;
        for (idx, page) in pages.iter().enumerate() {
            insert.execute(params![
                project_id,
                run_id,
                idx as i64,
                text(page, "url"),
                page.to_string()
            ])?;
        }
    }
    tx.commit()
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
        let mut value: Value = serde_json::from_str(&meta).unwrap_or(Value::Null);
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
    rows.map(|row| Ok(serde_json::from_str(&row?).unwrap_or(Value::Null)))
        .collect()
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
pub fn load_run(conn: &Connection, project_id: &str, run_id: &str) -> Result<Option<Value>> {
    let meta: Option<String> = conn
        .query_row(
            "SELECT meta FROM crawl_runs WHERE project_id = ?1 AND run_id = ?2",
            params![project_id, run_id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(meta) = meta else { return Ok(None) };
    let mut run: Value = serde_json::from_str(&meta).unwrap_or(Value::Null);
    run["result"]["pages"] = Value::Array(pages_query(conn, project_id, run_id, 0, -1)?);
    Ok(Some(run))
}

pub fn delete_run(conn: &Connection, project_id: &str, run_id: &str) -> Result<usize> {
    conn.execute(
        "DELETE FROM crawl_runs WHERE project_id = ?1 AND run_id = ?2",
        params![project_id, run_id],
    )
}
