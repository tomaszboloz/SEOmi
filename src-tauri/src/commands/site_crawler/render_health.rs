use std::time::{Duration, Instant};

use super::fetch_types::FetchedPageData;

/// Upper bound for simultaneously open hidden renderer windows. Every window
/// is a full browser context, so this is capped well below the HTTP limit.
pub(crate) const MAX_RENDER_SESSIONS: usize = 6;

/// A renderer that keeps failing is not retried for every remaining page.
pub(crate) const MAX_CONSECUTIVE_RENDER_FAILURES: usize = 5;

/// Time left in the configured run budget; effectively unbounded without one.
pub(crate) fn remaining_run_time(start_time: Instant, max_run_seconds: Option<u64>) -> Duration {
    max_run_seconds
        .map(|seconds| Duration::from_secs(seconds).saturating_sub(start_time.elapsed()))
        .unwrap_or(Duration::from_secs(24 * 60 * 60))
}

/// Tracks how rendering goes across a crawl, so that a broken renderer is
/// reported once at crawl level and stops costing a window per page.
#[derive(Debug, Default)]
pub(crate) struct RenderHealth {
    pub(crate) fallback_pages: usize,
    pub(crate) consecutive_failures: usize,
}

impl RenderHealth {
    pub(crate) fn record_success(&mut self) {
        self.consecutive_failures = 0;
    }

    pub(crate) fn record_fallback(&mut self) {
        self.fallback_pages += 1;
        self.consecutive_failures += 1;
    }

    pub(crate) fn rendering_enabled(&self) -> bool {
        self.consecutive_failures < MAX_CONSECUTIVE_RENDER_FAILURES
    }

    /// Account for one analyzed page: rendered in the browser, analyzed from
    /// raw HTML instead, or (downloads, errors) never meant to be rendered.
    pub(crate) fn observe(&mut self, page: &FetchedPageData) {
        if page.rendered_diagnostics.is_some() {
            self.record_success();
        }
        if page.render_fallback.is_some() {
            self.record_fallback();
        }
    }
}
