use super::concurrency::HostGates;
use super::models::{ExternalLinkCheck, MAX_CONCURRENT_EXTERNAL_LINKS};
use std::future::Future;
use tokio::task::JoinSet;

/// Check every URL with bounded concurrency, reporting each finished check
/// together with the number of checks completed so far.
pub(super) async fn run_checks<F, Fut>(
    selected: Vec<String>,
    gates: HostGates,
    check: F,
    mut on_progress: impl FnMut(usize, &ExternalLinkCheck),
) -> Result<Vec<ExternalLinkCheck>, String>
where
    F: Fn(String, HostGates) -> Fut,
    Fut: Future<Output = ExternalLinkCheck> + Send + 'static,
{
    let scheduled = selected.len();
    let mut tasks: JoinSet<ExternalLinkCheck> = JoinSet::new();
    let mut pending = selected.into_iter();
    let mut results = Vec::with_capacity(scheduled);
    for url in pending.by_ref().take(MAX_CONCURRENT_EXTERNAL_LINKS) {
        tasks.spawn(check(url, gates.clone()));
    }
    while let Some(joined) = tasks.join_next().await {
        let result =
            joined.map_err(|_| "An external link check task failed unexpectedly".to_string())?;
        on_progress(results.len() + 1, &result);
        results.push(result);
        if let Some(url) = pending.next() {
            tasks.spawn(check(url, gates.clone()));
        }
    }
    Ok(results)
}

#[cfg(test)]
#[path = "runner_tests.rs"]
mod tests;
