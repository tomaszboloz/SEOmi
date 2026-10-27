mod concurrency;
mod models;
mod network;
mod request;
mod request_flow;
mod result;
mod runner;

use concurrency::new_host_gates;
pub use models::{ExternalLinkCheck, ExternalLinkCheckBatch, ExternalLinkCheckProgress};
use models::{DEFAULT_EXTERNAL_LINK_LIMIT, MAX_EXTERNAL_LINKS_PER_RUN};
use network::{check_one_with_gates, normalize_external_url};
use runner::run_checks;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn check_external_crawl_links<R: tauri::Runtime>(
    app: AppHandle<R>,
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
    let host_gates = new_host_gates();
    let mut results = run_checks(
        selected,
        host_gates,
        check_one_with_gates,
        |done, current| {
            let _ = app.emit(
                "crawl-external-link-progress",
                ExternalLinkCheckProgress {
                    request_id: request_id.clone(),
                    completed: done,
                    total: scheduled,
                    current_url: current.url.clone(),
                    http_status: current.http_status,
                    request_error_kind: current.request_error_kind.clone(),
                },
            );
        },
    )
    .await?;
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

#[cfg(test)]
#[path = "external_link_checker/command_tests.rs"]
mod command_tests;

#[cfg(test)]
#[path = "external_link_checker/ipc_tests.rs"]
mod ipc_tests;

#[cfg(test)]
#[path = "external_link_checker/network_tests.rs"]
mod network_tests;

#[cfg(test)]
#[path = "external_link_checker/http_tests/mod.rs"]
mod http_tests;

#[cfg(test)]
#[path = "external_link_checker/network_error_path_tests.rs"]
mod network_error_path_tests;

#[cfg(test)]
#[path = "external_link_checker/batch_and_edge_error_tests.rs"]
mod batch_and_edge_error_tests;

#[cfg(test)]
#[path = "external_link_checker/request_edge_tests.rs"]
mod request_edge_tests;

#[cfg(test)]
#[path = "external_link_checker/concurrency_tests.rs"]
mod concurrency_tests;

#[cfg(test)]
#[path = "external_link_checker/redirect_and_dns_edge_tests.rs"]
mod redirect_and_dns_edge_tests;

#[cfg(test)]
#[path = "external_link_checker/gap_tests.rs"]
mod gap_tests;

#[cfg(test)]
#[path = "external_link_checker/normalized_dedup_tests.rs"]
mod normalized_dedup_tests;
