use std::collections::HashMap;
use tauri::Runtime;

use super::super::fetch_types::{CrawlFetchFailure, FetchedResponse};
use super::state::CrawlLoopState;
use crate::commands::rendered_crawler::RenderedCrawlerSession;

pub(super) type PrefetchTaskOutcome<R> = (
    String,
    Option<RenderedCrawlerSession<R>>,
    Result<FetchedResponse, CrawlFetchFailure>,
);

pub(super) type JoinedPrefetchTask<R> = Result<PrefetchTaskOutcome<R>, tokio::task::JoinError>;

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

pub(super) fn handle_joined_prefetch_task<R: Runtime>(
    state: &mut CrawlLoopState<R>,
    task_urls: &mut HashMap<tokio::task::Id, String>,
    joined: JoinedPrefetchTask<R>,
) {
    match joined {
        Ok((url, session, result)) => {
            state.rendered_sessions.extend(session);
            state.prefetched_responses.insert(url, result);
        }
        Err(error) if error.is_cancelled() => {}
        Err(error) => record_task_failure(state, task_urls, &error),
    }
}
