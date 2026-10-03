use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

pub(crate) const AUDIT_RATE_WINDOW_MS: i64 = 60_000;
pub(crate) const AUDIT_RATE_LIMIT: usize = 10;
pub(crate) const AUDIT_MIN_INTERVAL_MS: i64 = 150;

/// Process-wide guard for direct page audits. Crawls use their own bounded
/// frontier and are deliberately not counted here. Keeping the timestamps in
/// a sliding window prevents a burst of IPC calls from turning into an
/// unbounded outbound request stream while still allowing normal audit usage.
pub(crate) struct AuditRateLimiter {
    timestamps_ms: Mutex<VecDeque<i64>>,
}

impl AuditRateLimiter {
    pub(crate) fn new() -> Self {
        Self {
            timestamps_ms: Mutex::new(VecDeque::with_capacity(AUDIT_RATE_LIMIT)),
        }
    }

    pub(crate) fn check(&self, now_ms: i64) -> Result<(), &'static str> {
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

pub(crate) fn audit_rate_limiter() -> &'static AuditRateLimiter {
    AUDIT_RATE_LIMITER.get_or_init(AuditRateLimiter::new)
}
