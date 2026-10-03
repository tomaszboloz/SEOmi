mod models;
mod network;

pub use models::{ExternalLinkCheck, ExternalLinkCheckBatch, ExternalLinkCheckProgress};
use models::{
    DEFAULT_EXTERNAL_LINK_LIMIT, MAX_CONCURRENT_EXTERNAL_LINKS, MAX_EXTERNAL_LINKS_PER_RUN,
};
use network::{check_one, normalize_external_url};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinSet;

#[tauri::command]
pub async fn check_external_crawl_links(
    app: AppHandle,
    request_id: String,
    urls: Vec<String>,
    max_urls: Option<usize>,
) -> Result<ExternalLinkCheckBatch, String> {
    if urls.len() > 20_000 {
        return Err("Too many external link targets were supplied (maximum input: 20,000)".into());
    }
    let limit = max_urls
        .unwrap_or(DEFAULT_EXTERNAL_LINK_LIMIT)
        .clamp(1, MAX_EXTERNAL_LINKS_PER_RUN);
    let mut unique = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for input in urls {
        match normalize_external_url(&input) {
            Ok(url) => {
                let normalized = url.to_string();
                if seen.insert(normalized.clone()) {
                    unique.push(normalized);
                }
            }
            Err(_) => {
                let normalized = input.trim().to_string();
                if !normalized.is_empty() && seen.insert(normalized.clone()) {
                    unique.push(normalized);
                }
            }
        }
    }
    let unique_count = unique.len();
    let selected = unique
        .into_iter()
        .take(limit.min(MAX_EXTERNAL_LINKS_PER_RUN))
        .collect::<Vec<_>>();
    let scheduled = selected.len();
    let mut tasks: JoinSet<ExternalLinkCheck> = JoinSet::new();
    let mut pending = selected.into_iter();
    let mut results = Vec::with_capacity(scheduled);
    for _ in 0..MAX_CONCURRENT_EXTERNAL_LINKS.min(scheduled) {
        if let Some(url) = pending.next() {
            tasks.spawn(check_one(url));
        }
    }
    while let Some(joined) = tasks.join_next().await {
        match joined {
            Ok(result) => {
                results.push(result);
                if let Some(current) = results.last() {
                    let _ = app.emit(
                        "crawl-external-link-progress",
                        ExternalLinkCheckProgress {
                            request_id: request_id.clone(),
                            completed: results.len(),
                            total: scheduled,
                            current_url: current.url.clone(),
                            http_status: current.http_status,
                            request_error_kind: current.request_error_kind.clone(),
                        },
                    );
                }
            }
            Err(_) => return Err("An external link check task failed unexpectedly".into()),
        }
        if let Some(url) = pending.next() {
            tasks.spawn(check_one(url));
        }
    }
    results.sort_by(|left, right| left.url.cmp(&right.url));
    Ok(ExternalLinkCheckBatch {
        requested: unique_count,
        checked: results.len(),
        omitted: unique_count.saturating_sub(results.len()),
        results,
    })
}

#[cfg(test)]
#[path = "external_link_checker/tests.rs"]
mod tests;
