use std::time::{Duration, Instant};

pub(super) const MAX_PROXIES: usize = 64;
const MAX_PROXY_URL_LEN: usize = 2_048;

#[derive(Debug)]
struct Entry {
    url: String,
    failures: u32,
    banned_until: Option<Instant>,
}

/// User-supplied proxy list: round-robin rotation, ban after consecutive failures, health re-entry
/// after a cool-down. Time is injected so behaviour is deterministic and testable.
#[derive(Debug)]
pub(super) struct ProxyPool {
    entries: Vec<Entry>,
    cursor: usize,
    max_failures: u32,
    ban: Duration,
}

/// Validates one proxy URL: http(s) with a host, bounded length.
pub(super) fn validate_proxy_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.len() > MAX_PROXY_URL_LEN {
        return Err("Proxy URL cannot exceed 2048 characters.".into());
    }
    let parsed = url::Url::parse(trimmed).map_err(|_| "Invalid proxy URL.".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("Proxy URL must use HTTP or HTTPS and include a hostname.".into());
    }
    Ok(trimmed.to_owned())
}

/// Hides credentials so a proxy can be shown in reports and logs.
pub(super) fn redact_proxy_url(value: &str) -> String {
    match url::Url::parse(value) {
        Ok(mut parsed) => {
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
            parsed.to_string()
        }
        Err(_) => "<invalid proxy>".into(),
    }
}

impl ProxyPool {
    pub(super) fn new(urls: &[String], max_failures: u32, ban: Duration) -> Result<Self, String> {
        if urls.is_empty() || urls.len() > MAX_PROXIES {
            return Err(format!("Provide between 1 and {MAX_PROXIES} proxies."));
        }
        let mut entries: Vec<Entry> = Vec::with_capacity(urls.len());
        for value in urls {
            let url = validate_proxy_url(value)?;
            if entries.iter().any(|entry| entry.url == url) {
                return Err("Duplicate proxy in the list.".into());
            }
            entries.push(Entry {
                url,
                failures: 0,
                banned_until: None,
            });
        }
        Ok(Self {
            entries,
            cursor: 0,
            max_failures: max_failures.max(1),
            ban,
        })
    }

    fn available(&mut self, index: usize, now: Instant) -> bool {
        let entry = &mut self.entries[index];
        match entry.banned_until {
            Some(until) if now < until => false,
            Some(_) => {
                entry.banned_until = None;
                entry.failures = 0;
                true
            }
            None => true,
        }
    }

    /// Next healthy proxy index, or `None` while every proxy is banned.
    pub(super) fn next(&mut self, now: Instant) -> Option<usize> {
        for step in 0..self.entries.len() {
            let index = (self.cursor + step) % self.entries.len();
            if self.available(index, now) {
                self.cursor = (index + 1) % self.entries.len();
                return Some(index);
            }
        }
        None
    }

    pub(super) fn url(&self, index: usize) -> Option<&str> {
        self.entries.get(index).map(|entry| entry.url.as_str())
    }

    pub(super) fn record_success(&mut self, index: usize) {
        if let Some(entry) = self.entries.get_mut(index) {
            entry.failures = 0;
        }
    }

    pub(super) fn record_failure(&mut self, index: usize, now: Instant) {
        if let Some(entry) = self.entries.get_mut(index) {
            entry.failures += 1;
            if entry.failures >= self.max_failures {
                entry.banned_until = Some(now + self.ban);
            }
        }
    }

    pub(super) fn healthy_count(&mut self, now: Instant) -> usize {
        (0..self.entries.len())
            .filter(|index| self.available(*index, now))
            .count()
    }
}

#[cfg(test)]
#[path = "proxy_pool_tests.rs"]
mod tests;
