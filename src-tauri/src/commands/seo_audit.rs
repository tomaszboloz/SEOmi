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
#[cfg(not(test))]
pub(crate) use rate_limiter::audit_rate_limiter;
pub use rate_limiter::AuditRateLimiter;
use transport::fetch_and_analyze;
pub use transport::AuditTransport;

fn normalize_request_id(value: Option<String>) -> String {
    value
        .map(|value| value.trim().chars().take(128).collect::<String>())
        .filter(|value| !value.is_empty() && !value.chars().any(|character| character == '\0'))
        .unwrap_or_else(|| Uuid::new_v4().simple().to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn inspect_url(
    url: String,
    user_agent: Option<String>,
    timeout_secs: Option<u64>,
    max_redirects: Option<usize>,
    verify_ssl: Option<bool>,
    request_id: Option<String>,
    control: State<'_, AuditControl>,
    rate_limiter: State<'_, AuditRateLimiter>,
    audit_transport: State<'_, AuditTransport>,
) -> Result<PageAuditData, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    #[cfg(test)]
    rate_limiter.check(now_ms).map_err(str::to_owned)?;
    #[cfg(not(test))]
    {
        let _ = &rate_limiter;
        audit_rate_limiter().check(now_ms).map_err(str::to_owned)?;
    }

    let validated_url = url_validator::validate_and_normalize_url(&url)
        .map_err(|e| format!("URL validation failed: {}", e))?;

    let ua = user_agents::resolve_user_agent(user_agent.as_deref());
    let timeout = timeout_secs.unwrap_or(15).clamp(3, 60);
    let request_id = normalize_request_id(request_id);
    let audit_transport = audit_transport.inner().clone();
    request::run_controlled(&control, &request_id, async {
        audit_transport
            .fetch_and_analyze(
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
#[path = "seo_audit/ipc_transport_tests.rs"]
mod ipc_transport_tests;
#[cfg(test)]
#[path = "seo_audit/tests.rs"]
mod tests;
#[cfg(test)]
#[path = "seo_audit/transport_tests.rs"]
mod transport_tests;
