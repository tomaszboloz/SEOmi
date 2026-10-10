use super::models::ExternalLinkCheck;
use std::{
    sync::{Arc, Mutex},
    time::Instant,
};

pub(super) type ChainState = Arc<Mutex<Option<String>>>;

pub(super) fn new_chain_state() -> ChainState {
    Arc::new(Mutex::new(None))
}

pub(super) fn record_redirect(state: &ChainState, target: &str) {
    if let Ok(mut value) = state.lock() {
        *value = Some(target.to_owned());
    }
}

pub(super) fn timeout_result(url: String, state: &ChainState) -> ExternalLinkCheck {
    let redirect = state.lock().ok().and_then(|value| value.clone());
    failed(url, redirect, "timeout")
}

pub(super) fn failed(
    url: String,
    redirect_url: Option<String>,
    kind: impl Into<String>,
) -> ExternalLinkCheck {
    let kind = if redirect_url.is_some() {
        "unverifiable".to_owned()
    } else {
        kind.into()
    };
    ExternalLinkCheck {
        url,
        http_status: None,
        response_time_ms: None,
        redirect_url,
        request_error_kind: Some(kind),
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}

pub(super) fn observed(
    url: String,
    status: u16,
    elapsed_ms: u64,
    redirect_url: Option<String>,
    error: Option<&str>,
) -> ExternalLinkCheck {
    ExternalLinkCheck {
        url,
        http_status: Some(status),
        response_time_ms: Some(elapsed_ms),
        redirect_url,
        request_error_kind: error.map(str::to_string),
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}

pub(super) fn redirect_failure(
    url: String,
    status: u16,
    started: Instant,
    redirect_url: Option<String>,
) -> ExternalLinkCheck {
    observed(
        url,
        status,
        started.elapsed().as_millis() as u64,
        redirect_url,
        Some("unverifiable"),
    )
}
