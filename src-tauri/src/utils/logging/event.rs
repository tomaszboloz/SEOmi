use serde::{Deserialize, Serialize};
use std::{
    io,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct NativeEvent {
    pub(super) level: String,
    pub(super) event: String,
    pub(super) request_id: Uuid,
    pub(super) timestamp_ms: u128,
    pub(super) route: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) accepted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) dispatch_duration_ms: Option<u128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) task_duration_ms: Option<u128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) task_started: Option<bool>,
}

pub(super) fn event(level: &str, name: &str, request_id: Uuid, route: &str) -> NativeEvent {
    NativeEvent {
        level: level.to_owned(),
        event: name.to_owned(),
        request_id,
        timestamp_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        route: route.to_owned(),
        accepted: None,
        dispatch_duration_ms: None,
        task_duration_ms: None,
        task_started: None,
    }
}

pub(super) fn emit(event: &NativeEvent) -> io::Result<()> {
    let json = serde_json::to_string(event)?;
    match event.level.as_str() {
        "error" => log::error!(target: "seomi::event", "{json}"),
        "warn" => log::warn!(target: "seomi::event", "{json}"),
        _ => log::info!(target: "seomi::event", "{json}"),
    }
    Ok(())
}
