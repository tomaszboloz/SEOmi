use std::{
    fmt,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use super::super::request_error::request_error_kind;

#[derive(Debug)]
pub(crate) struct RetryBudget {
    remaining: AtomicUsize,
}

impl RetryBudget {
    pub(crate) fn new(max_retries: usize) -> Arc<Self> {
        Arc::new(Self {
            remaining: AtomicUsize::new(max_retries),
        })
    }

    pub(super) fn take(&self) -> bool {
        self.remaining
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |value| {
                value.checked_sub(1)
            })
            .is_ok()
    }

    #[cfg(test)]
    pub(crate) fn remaining(&self) -> usize {
        self.remaining.load(Ordering::Acquire)
    }
}

#[derive(Clone)]
pub(crate) struct RetryContext {
    pub(crate) budget: Arc<RetryBudget>,
    started_at: Instant,
    max_run_seconds: Option<u64>,
}

impl RetryContext {
    pub(crate) fn new(
        budget: Arc<RetryBudget>,
        started_at: Instant,
        max_run_seconds: Option<u64>,
    ) -> Self {
        Self {
            budget,
            started_at,
            max_run_seconds,
        }
    }

    pub(crate) fn disabled() -> Self {
        Self::new(RetryBudget::new(0), Instant::now(), None)
    }

    pub(super) fn remaining(&self) -> Option<Duration> {
        self.max_run_seconds.map(|seconds| {
            Duration::from_secs(seconds)
                .checked_sub(self.started_at.elapsed())
                .unwrap_or_default()
        })
    }
}

#[derive(Debug)]
pub(crate) enum RetryError {
    Request(reqwest::Error),
    Deadline,
}

impl RetryError {
    pub(crate) fn kind(&self) -> String {
        match self {
            Self::Request(error) => request_error_kind(error),
            Self::Deadline => "timeout".into(),
        }
    }

    #[cfg(test)]
    pub(crate) fn into_request(self) -> reqwest::Error {
        match self {
            Self::Request(error) => error,
            Self::Deadline => unreachable!("the compatibility request has no deadline"),
        }
    }
}

impl fmt::Display for RetryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Request(error) => error.fmt(formatter),
            Self::Deadline => formatter.write_str("HTTP operation exceeded the crawl deadline"),
        }
    }
}

impl std::error::Error for RetryError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Request(error) => Some(error),
            Self::Deadline => None,
        }
    }
}

#[derive(Debug)]
pub(crate) struct RetriedResponse {
    pub(crate) response: reqwest::Response,
    pub(crate) retries: u8,
}
