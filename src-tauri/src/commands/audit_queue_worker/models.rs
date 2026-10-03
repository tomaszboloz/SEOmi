use chrono::DateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub(super) const MAX_QUEUE_ITEMS: usize = 50_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct QueueItem {
    pub(super) id: String,
    pub(super) url: String,
    pub(super) status: String,
    #[serde(default)]
    pub(super) error: Option<String>,
    #[serde(default)]
    pub(super) attempts: Option<u32>,
    #[serde(default)]
    pub(super) updated_at: Option<String>,
    #[serde(default)]
    pub(super) completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct QueueRun {
    pub(super) id: String,
    pub(super) status: String,
    pub(super) started_at: String,
    pub(super) updated_at: String,
    #[serde(default)]
    pub(super) active_item_id: Option<String>,
    #[serde(default)]
    pub(super) last_error: Option<String>,
    #[serde(default)]
    pub(super) stop_requested: bool,
    #[serde(default)]
    pub(super) user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct QueueSnapshot {
    pub(super) items: Vec<QueueItem>,
    #[serde(default)]
    pub(super) run: Option<QueueRun>,
}

pub(super) fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

pub(super) fn parse_snapshot(value: Value) -> Result<QueueSnapshot, String> {
    let snapshot: QueueSnapshot = serde_json::from_value(value)
        .map_err(|error| format!("Saved audit queue is invalid: {error}"))?;
    if snapshot.items.len() > MAX_QUEUE_ITEMS {
        return Err("Saved audit queue exceeds the item safety limit.".into());
    }
    if snapshot.items.iter().any(|item| {
        !valid_identifier(&item.id)
            || item.url.trim().is_empty()
            || !matches!(
                item.status.as_str(),
                "queued" | "running" | "interrupted" | "completed" | "failed"
            )
    }) {
        return Err("Saved audit queue contains an invalid item.".into());
    }
    if let Some(run) = &snapshot.run {
        if !valid_identifier(&run.id)
            || !matches!(
                run.status.as_str(),
                "running" | "interrupted" | "stopped" | "completed"
            )
        {
            return Err("Saved audit queue contains an invalid run.".into());
        }
        DateTime::parse_from_rfc3339(&run.updated_at)
            .map_err(|_| "Saved audit queue run has an invalid update timestamp.")?;
    }
    Ok(snapshot)
}
