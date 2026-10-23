use super::waf_block::detect_waf_block;
use reqwest::header::HeaderMap;
use std::time::Duration;

const FIRST_STEP: Duration = Duration::from_secs(1);
const MAX_EXTRA: Duration = Duration::from_secs(60);
const NOISE_FLOOR: Duration = Duration::from_millis(250);

/// Extra pause added on top of the robots.txt crawl-delay while a site is
/// throttling or blocking the crawler. Doubles on each signal, halves on
/// each healthy response. It slows the crawl down and never evades anything.
#[derive(Debug, Default)]
pub(crate) struct AdaptiveBackoff {
    extra: Duration,
}

impl AdaptiveBackoff {
    /// Feed one HTTP response; returns the protection layer if one answered.
    pub(crate) fn observe(&mut self, status: u16, headers: &HeaderMap) -> Option<&'static str> {
        let waf = detect_waf_block(status, headers);
        if waf.is_some() || matches!(status, 429 | 503) {
            self.extra = (self.extra * 2).max(FIRST_STEP).min(MAX_EXTRA);
        } else {
            self.extra /= 2;
            if self.extra < NOISE_FLOOR {
                self.extra = Duration::ZERO;
            }
        }
        waf
    }

    /// Delay to wait between page requests, or `None` when nothing applies.
    pub(crate) fn effective_delay(&self, robots: Option<Duration>) -> Option<Duration> {
        match (robots, self.extra.is_zero()) {
            (base, true) => base,
            (base, false) => Some(base.unwrap_or_default() + self.extra),
        }
    }
}

#[cfg(test)]
#[path = "adaptive_backoff_tests.rs"]
mod tests;
