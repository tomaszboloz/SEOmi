use std::collections::VecDeque;
use std::sync::Mutex;

pub(crate) const AUDIT_RATE_WINDOW_MS: i64 = 60_000;
pub(crate) const AUDIT_RATE_LIMIT: usize = 10;
pub(crate) const AUDIT_MIN_INTERVAL_MS: i64 = 150;

/// App-wide guard (one managed instance per process) for direct page audits.
/// Crawls use their own bounded frontier and are deliberately not counted here.
/// Keeping the timestamps in a sliding window prevents a burst of IPC calls from turning into an
/// unbounded outbound request stream while still allowing normal audit usage.
pub struct AuditRateLimiter {
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

#[cfg(test)]
mod tests {
    use super::AuditRateLimiter;

    #[test]
    fn a_poisoned_limiter_reports_itself_unavailable() {
        let limiter = AuditRateLimiter::new();
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = limiter.timestamps_ms.lock().unwrap();
            panic!("poison the limiter");
        }));
        assert_eq!(limiter.check(0), Err("Audit rate limiter is unavailable."));
    }
}
