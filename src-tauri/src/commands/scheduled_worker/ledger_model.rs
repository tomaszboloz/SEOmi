use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;

pub const LEDGER_LIMIT: usize = 128;
pub(super) const TYPES: [&str; 6] = ["gsc", "pagespeed", "crawl", "semantic", "focus", "aio"];
pub(super) static PENDING: Mutex<Option<HashSet<String>>> = Mutex::new(None);

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntry {
    pub fingerprint: String,
    pub alert_type: String,
    pub occurred_at: String,
}

pub(super) fn valid(project_id: &str, fingerprint: &str, alert_type: &str) -> Result<(), String> {
    let ok = super::models::valid_identifier(project_id)
        && !fingerprint.is_empty()
        && fingerprint.len() <= 512
        && TYPES.contains(&alert_type);
    ok.then_some(())
        .ok_or_else(|| "Invalid monitoring alert identity.".into())
}

pub(super) fn window(frequency: &str) -> Result<Option<Duration>, String> {
    match frequency {
        "run" => Ok(None),
        "daily" => Ok(Some(Duration::days(1))),
        "weekly" => Ok(Some(Duration::days(7))),
        _ => Err("Invalid monitoring alert frequency.".into()),
    }
}

pub(super) fn keys(
    project_id: &str,
    fingerprint: &str,
    alert_type: &str,
    frequency: &str,
) -> Vec<String> {
    let mut keys = vec![format!("{project_id}\0fingerprint\0{fingerprint}")];
    if frequency != "run" {
        keys.push(format!("{project_id}\0type\0{alert_type}"));
    }
    keys
}

pub(super) fn is_duplicate(
    entries: &[LedgerEntry],
    fingerprint: &str,
    alert_type: &str,
    window: Option<Duration>,
    now: DateTime<Utc>,
) -> bool {
    entries.iter().any(|entry| {
        entry.fingerprint == fingerprint
            || window.is_some_and(|span| {
                entry.alert_type == alert_type
                    && DateTime::parse_from_rfc3339(&entry.occurred_at)
                        .is_ok_and(|at| at.with_timezone(&Utc) >= now - span)
            })
    })
}

#[cfg(test)]
#[path = "ledger_model_tests.rs"]
mod tests;
