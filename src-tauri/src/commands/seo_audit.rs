use crate::models::audit_data::PageAuditData;
use crate::services::{http_client, seo_analyzer};
use crate::utils::{url_validator, user_agents};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::sync::Notify;
use uuid::Uuid;

const AUDIT_RATE_WINDOW_MS: i64 = 60_000;
const AUDIT_RATE_LIMIT: usize = 10;
const AUDIT_MIN_INTERVAL_MS: i64 = 150;

/// Process-wide guard for direct page audits. Crawls use their own bounded
/// frontier and are deliberately not counted here. Keeping the timestamps in
/// a sliding window prevents a burst of IPC calls from turning into an
/// unbounded outbound request stream while still allowing normal audit usage.
struct AuditRateLimiter {
    timestamps_ms: Mutex<VecDeque<i64>>,
}

impl AuditRateLimiter {
    fn new() -> Self {
        Self {
            timestamps_ms: Mutex::new(VecDeque::with_capacity(AUDIT_RATE_LIMIT)),
        }
    }

    fn check(&self, now_ms: i64) -> Result<(), &'static str> {
        let mut timestamps = self
            .timestamps_ms
            .lock()
            .map_err(|_| "Audit rate limiter is unavailable.")?;
        while timestamps
            .front()
            .is_some_and(|timestamp| now_ms.saturating_sub(*timestamp) >= AUDIT_RATE_WINDOW_MS)
        {
            timestamps.pop_front();
        }
        if let Some(last_timestamp) = timestamps.back() {
            if now_ms.saturating_sub(*last_timestamp) < AUDIT_MIN_INTERVAL_MS {
                return Err("Audit requests are too frequent. Please wait a moment.");
            }
        }
        if timestamps.len() >= AUDIT_RATE_LIMIT {
            return Err("Audit rate limit reached. Try again in a minute.");
        }
        timestamps.push_back(now_ms);
        Ok(())
    }
}

static AUDIT_RATE_LIMITER: OnceLock<AuditRateLimiter> = OnceLock::new();

fn audit_rate_limiter() -> &'static AuditRateLimiter {
    AUDIT_RATE_LIMITER.get_or_init(AuditRateLimiter::new)
}

pub struct AuditControl {
    active: Mutex<HashMap<String, Arc<Notify>>>,
    cancelled_before_start: Mutex<HashSet<String>>,
}

impl AuditControl {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
            cancelled_before_start: Mutex::new(HashSet::new()),
        }
    }

    fn register(&self, request_id: &str) -> Arc<Notify> {
        let notify = Arc::new(Notify::new());
        if self
            .cancelled_before_start
            .lock()
            .map(|mut ids| ids.remove(request_id))
            .unwrap_or(true)
        {
            notify.notify_one();
        }
        if let Ok(mut active) = self.active.lock() {
            active.insert(request_id.to_string(), Arc::clone(&notify));
        }
        notify
    }

    fn cancel(&self, request_id: &str) -> bool {
        let notifier = self
            .active
            .lock()
            .ok()
            .and_then(|active| active.get(request_id).cloned());
        if let Some(notifier) = notifier {
            notifier.notify_waiters();
            return true;
        }
        self.cancelled_before_start
            .lock()
            .map(|mut ids| ids.insert(request_id.to_string()))
            .unwrap_or(false)
    }

    fn finish(&self, request_id: &str) {
        if let Ok(mut active) = self.active.lock() {
            active.remove(request_id);
        }
        if let Ok(mut ids) = self.cancelled_before_start.lock() {
            ids.remove(request_id);
        }
    }
}

impl Default for AuditControl {
    fn default() -> Self {
        Self::new()
    }
}

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
    // 1. Rate-limiting check (maximum 10 requests per minute plus a short
    // inter-request guard to prevent accidental double submits).
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    audit_rate_limiter().check(now_ms).map_err(str::to_owned)?;

    // 2. Validate URL & block SSRF to internal networks
    let validated_url = url_validator::validate_and_normalize_url(&url)
        .map_err(|e| format!("URL validation failed: {}", e))?;

    // 3. Resolve and sanitize user agent
    let ua = user_agents::resolve_user_agent(user_agent.as_deref());
    let timeout = timeout_secs.unwrap_or(15).clamp(3, 60);
    let request_id = normalize_request_id(request_id);
    let cancellation = control.register(&request_id);

    // 4. Fetch the webpage with full redirect tracking and timing
    let fetch_result = tokio::select! {
        _ = cancellation.notified() => {
            control.finish(&request_id);
            return Err("Audit cancelled by user.".to_string());
        }
        result = fetch_and_analyze(&validated_url, &ua, timeout, max_redirects.unwrap_or(10), verify_ssl.unwrap_or(true)) => {
            // The shared helper performs both the fetch and analysis. Keeping
            // this branch as a single future preserves cancellation while
            // allowing the headless scheduler to reuse the exact audit path.
            result.map_err(|e| format!("Network request failed: {}", e))?
        }
    };
    let audit_data = fetch_result;
    control.finish(&request_id);
    Ok(audit_data)
}

/// Execute the same deterministic page audit without an IPC `State` guard.
/// This is used only by the signed desktop scheduler worker after it has
/// validated the persisted task manifest. It deliberately shares the exact
/// transport/analyzer path with the interactive command.
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

async fn fetch_and_analyze(
    validated_url: &url::Url,
    user_agent: &str,
    timeout_secs: u64,
    max_redirects: usize,
    verify_ssl: bool,
) -> Result<PageAuditData, anyhow::Error> {
    let request = if max_redirects == 10 && verify_ssl {
        http_client::fetch_page(validated_url, user_agent, timeout_secs).await
    } else {
        http_client::fetch_page_with_options(
            validated_url,
            user_agent,
            timeout_secs,
            max_redirects,
            verify_ssl,
        )
        .await
    };
    let fetch_result =
        request.map_err(|error| anyhow::anyhow!("Network request failed: {error}"))?;
    seo_analyzer::analyze_page(fetch_result)
        .await
        .map_err(|error| anyhow::anyhow!("SEO analysis failed: {error}"))
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
mod tests {
    use super::*;

    #[test]
    fn request_ids_are_bounded_and_have_a_fallback() {
        let fallback = normalize_request_id(None);
        assert!(!fallback.is_empty());
        assert!(normalize_request_id(Some("a".repeat(200))).chars().count() <= 128);
        assert!(!normalize_request_id(Some("bad\0id".into())).contains('\0'));
    }

    #[tokio::test]
    async fn cancellation_notifies_an_active_request() {
        let control = AuditControl::new();
        let notify = control.register("request-1");
        let waiting = notify.notified();
        assert!(control.cancel("request-1"));
        tokio::time::timeout(std::time::Duration::from_millis(100), waiting)
            .await
            .expect("cancellation notification");
        control.finish("request-1");
        assert!(control.cancel("request-before-register"));
    }

    #[test]
    fn rate_limiter_allows_ten_spaced_requests_and_rejects_the_eleventh() {
        let limiter = AuditRateLimiter::new();
        for index in 0..AUDIT_RATE_LIMIT {
            assert!(limiter.check(index as i64 * AUDIT_MIN_INTERVAL_MS).is_ok());
        }
        assert_eq!(
            limiter.check(AUDIT_RATE_LIMIT as i64 * AUDIT_MIN_INTERVAL_MS),
            Err("Audit rate limit reached. Try again in a minute.")
        );
    }

    #[test]
    fn rate_limiter_expires_old_entries_after_one_minute() {
        let limiter = AuditRateLimiter::new();
        for index in 0..AUDIT_RATE_LIMIT {
            assert!(limiter.check(index as i64 * AUDIT_MIN_INTERVAL_MS).is_ok());
        }
        assert!(limiter
            .check(AUDIT_RATE_WINDOW_MS + AUDIT_MIN_INTERVAL_MS)
            .is_ok());
    }
}
