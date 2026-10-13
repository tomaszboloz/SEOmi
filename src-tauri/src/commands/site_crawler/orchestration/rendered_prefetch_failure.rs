use std::collections::HashMap;
use tauri::Runtime;

use super::super::fetch_types::CrawlFetchFailure;
use super::state::CrawlLoopState;

pub(super) fn record_task_failure<R: Runtime>(
    state: &mut CrawlLoopState<R>,
    task_urls: &mut HashMap<tokio::task::Id, String>,
    error: &tokio::task::JoinError,
) {
    log::error!("rendered prefetch task failed: {error}");
    if let Some(url) = task_urls.remove(&error.id()) {
        let kind = "prefetch_task".into();
        let failure = CrawlFetchFailure {
            kind,
            message: error.to_string(),
        };
        state.prefetched_responses.insert(url, Err(failure));
    }
}
