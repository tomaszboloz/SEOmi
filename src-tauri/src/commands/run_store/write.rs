use rusqlite::{params, Connection, Error, Result, TransactionBehavior};
use serde_json::Value;
use std::collections::HashSet;

fn text<'a>(run: &'a Value, key: &str) -> &'a str {
    run.get(key).and_then(Value::as_str).unwrap_or("")
}

pub(super) fn validate(run: &Value) -> Result<()> {
    let valid_pages = run
        .pointer("/result/pages")
        .and_then(Value::as_array)
        .is_some_and(|pages| {
            pages
                .iter()
                .all(|page| page.get("url").is_some_and(Value::is_string))
        });
    if text(run, "id").trim().is_empty()
        || text(run, "completedAt").is_empty()
        || text(run, "startUrl").is_empty()
        || !valid_pages
    {
        return Err(Error::InvalidParameterName(
            "Invalid crawl run snapshot.".into(),
        ));
    }
    Ok(())
}

/// Called inside the caller's transaction so pages and import journal commit together.
pub(super) fn write_run(conn: &Connection, project: &str, run: &Value) -> Result<()> {
    validate(run)?;
    let mut meta = run.clone();
    let Value::Array(pages) = meta["result"]["pages"].take() else {
        unreachable!()
    };
    let id = text(run, "id");
    conn.execute(
        "DELETE FROM crawl_runs WHERE project_id = ?1 AND run_id = ?2",
        params![project, id],
    )?;
    conn.execute(
        "INSERT INTO crawl_runs VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            project,
            text(run, "completedAt"),
            text(run, "startUrl"),
            meta.to_string(),
            pages.len() as i64
        ],
    )?;
    let mut insert = conn.prepare("INSERT INTO crawl_pages VALUES (?1, ?2, ?3, ?4, ?5)")?;
    for (idx, page) in pages.iter().enumerate() {
        insert.execute(params![
            project,
            id,
            idx as i64,
            text(page, "url"),
            page.to_string()
        ])?;
    }
    Ok(())
}

pub fn save_run(conn: &mut Connection, project: &str, run: &Value) -> Result<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    write_run(&tx, project, run)?;
    tx.commit()
}

/// Replace exactly one project's history. Any failed page insert rolls back all rows.
pub fn replace_runs(conn: &mut Connection, project: &str, runs: &[Value]) -> Result<()> {
    let mut ids = HashSet::new();
    if runs.len() > 50 {
        return Err(Error::InvalidParameterName(
            "At most 50 crawl runs are allowed.".into(),
        ));
    }
    for run in runs {
        validate(run)?;
        if !ids.insert(text(run, "id")) {
            return Err(Error::InvalidParameterName(
                "Duplicate crawl run id.".into(),
            ));
        }
    }
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    tx.execute("DELETE FROM crawl_runs WHERE project_id = ?1", [project])?;
    for run in runs {
        write_run(&tx, project, run)?;
    }
    tx.commit()
}
