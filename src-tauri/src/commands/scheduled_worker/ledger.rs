//! Native delivery ledger of monitoring alerts (#98): one place that decides whether an alert was already
//! delivered, so the schedule, the restart reconciliation and every WebView window share one answer.
use super::ledger_model::{is_duplicate, keys, valid, window, LedgerEntry, LEDGER_LIMIT, PENDING};
use super::models::MAX_EXECUTION_BYTES;
use super::storage::{read_json, write_json_atomic};
use crate::commands::crawl_storage;
use chrono::{DateTime, Utc};
use std::collections::HashSet;
use std::path::PathBuf;
use tauri::AppHandle;

fn path<R: tauri::Runtime>(app: &AppHandle<R>, project_id: &str) -> Result<PathBuf, String> {
    Ok(crawl_storage::project_directory(app, project_id)?.join("monitoring_ledger.json"))
}

fn read<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<Vec<LedgerEntry>, String> {
    Ok(read_json(&path(app, project_id)?, MAX_EXECUTION_BYTES)?.unwrap_or_default())
}

fn with_pending<T>(job: impl FnOnce(&mut HashSet<String>) -> T) -> T {
    let mut guard = PENDING.lock().unwrap_or_else(|poison| poison.into_inner());
    job(guard.get_or_insert_with(HashSet::new))
}

pub(super) fn reserve_at<R: tauri::Runtime>(
    app: &AppHandle<R>,
    (project_id, fingerprint, alert_type, frequency): (&str, &str, &str, &str),
    now: DateTime<Utc>,
) -> Result<bool, String> {
    valid(project_id, fingerprint, alert_type)?;
    let span = window(frequency)?;
    let entries = read(app, project_id)?;
    let wanted = keys(project_id, fingerprint, alert_type, frequency);
    let duplicate = is_duplicate(&entries, fingerprint, alert_type, span, now);
    Ok(with_pending(|pending| {
        if duplicate || wanted.iter().any(|key| pending.contains(key)) {
            return true;
        }
        pending.extend(wanted);
        false
    }))
}

pub(super) fn finish_at<R: tauri::Runtime>(
    app: &AppHandle<R>,
    (project_id, fingerprint, alert_type, frequency): (&str, &str, &str, &str),
    delivered: Option<&str>,
) -> Result<bool, String> {
    valid(project_id, fingerprint, alert_type)?;
    window(frequency)?;
    with_pending(|pending| {
        keys(project_id, fingerprint, alert_type, frequency)
            .iter()
            .for_each(|key| {
                pending.remove(key);
            })
    });
    let Some(occurred_at) = delivered else {
        return Ok(false);
    };
    DateTime::parse_from_rfc3339(occurred_at)
        .map_err(|_| "Monitoring alert time must be RFC3339.".to_string())?;
    let mut entries = read(app, project_id)?;
    if !entries.iter().any(|entry| entry.fingerprint == fingerprint) {
        entries.push(LedgerEntry {
            fingerprint: fingerprint.into(),
            alert_type: alert_type.into(),
            occurred_at: occurred_at.into(),
        });
        let excess = entries.len().saturating_sub(LEDGER_LIMIT);
        entries.drain(..excess);
        write_json_atomic(
            &path(app, project_id)?,
            &serde_json::to_value(&entries).expect("entries serialize"),
            MAX_EXECUTION_BYTES,
        )?;
    }
    Ok(true)
}

#[tauri::command]
pub fn reserve_monitoring_alert<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    fingerprint: String,
    alert_type: String,
    frequency: String,
) -> Result<bool, String> {
    reserve_at(
        &app,
        (&project_id, &fingerprint, &alert_type, &frequency),
        Utc::now(),
    )
}

#[tauri::command]
pub fn finish_monitoring_alert<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    fingerprint: String,
    alert_type: String,
    frequency: String,
    occurred_at: Option<String>,
) -> Result<bool, String> {
    finish_at(
        &app,
        (&project_id, &fingerprint, &alert_type, &frequency),
        occurred_at.as_deref(),
    )
}

#[tauri::command]
pub fn list_monitoring_ledger<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<LedgerEntry>, String> {
    valid(&project_id, "x", "gsc")?;
    read(&app, &project_id)
}

#[cfg(test)]
#[path = "ledger_tests.rs"]
mod tests;
