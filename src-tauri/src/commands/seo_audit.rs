use crate::models::audit_data::PageAuditData;
use crate::utils::{url_validator, user_agents};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use uuid::Uuid;

mod control;
mod rate_limiter;
mod request;
mod transport;

pub use control::AuditControl;
use rate_limiter::audit_rate_limiter;
use transport::fetch_and_analyze;

fn normalize_request_id(value: Option<String>) -> String {
    value
        .map(|value| value.trim().chars().take(128).collect::<String>())
        .filter(|value| !value.is_empty() && !value.chars().any(|character| character == '\0'))
        .unwrap_or_else(|| Uuid::new_v4().simple().to_string())
}

#[tauri::command]
pub async fn inspect_url(
    url: String,
    user_agent: Option<String>,
    timeout_secs: Option<u64>,
    max_redirects: Option<usize>,
    verify_ssl: Option<bool>,
    request_id: Option<String>,
    control: State<'_, AuditControl>,
) -> Result<PageAuditData, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    audit_rate_limiter().check(now_ms).map_err(str::to_owned)?;

    let validated_url = url_validator::validate_and_normalize_url(&url)
        .map_err(|e| format!("URL validation failed: {}", e))?;

    let ua = user_agents::resolve_user_agent(user_agent.as_deref());
    let timeout = timeout_secs.unwrap_or(15).clamp(3, 60);
    let request_id = normalize_request_id(request_id);
    request::run_controlled(&control, &request_id, async {
        fetch_and_analyze(
            &validated_url,
            &ua,
            timeout,
            max_redirects.unwrap_or(10),
            verify_ssl.unwrap_or(true),
        )
        .await
        .map_err(|error| format!("Network request failed: {error}"))
    })
    .await
}

pub async fn inspect_url_headless(
    url: &str,
    user_agent: Option<&str>,
    timeout_secs: u64,
) -> Result<PageAuditData, String> {
    let validated_url = url_validator::validate_and_normalize_url(url)
        .map_err(|error| format!("URL validation failed: {error}"))?;
    let ua = user_agents::resolve_user_agent(user_agent);
    let timeout = timeout_secs.clamp(3, 60);
    fetch_and_analyze(&validated_url, &ua, timeout, 10, true)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn cancel_inspect_url(
    request_id: String,
    control: State<'_, AuditControl>,
) -> Result<bool, String> {
    let request_id = normalize_request_id(Some(request_id));
    Ok(control.cancel(&request_id))
}

#[cfg(test)]
#[path = "seo_audit/tests.rs"]
mod tests;
#[cfg(test)]
#[path = "seo_audit/transport_tests.rs"]
mod transport_tests;
