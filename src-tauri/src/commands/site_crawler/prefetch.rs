use super::*;

#[path = "prefetch_window.rs"]
mod window;

pub(crate) use window::prefetch_http_pages_with_context;

#[allow(clippy::too_many_arguments)]
#[cfg(test)]
pub(super) async fn prefetch_http_pages(
    queue: &mut VecDeque<(String, usize)>,
    prefetched_order: &mut VecDeque<(String, usize)>,
    prefetched_responses: &mut HashMap<String, Result<FetchedResponse, CrawlFetchFailure>>,
    max_concurrent_requests: usize,
    max_pages: usize,
    completed_pages: usize,
    client: &reqwest::Client,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
    robots_rules: &[RobotsRule],
) {
    prefetch_http_pages_with_context(
        queue,
        prefetched_order,
        prefetched_responses,
        max_concurrent_requests,
        max_pages,
        completed_pages,
        client,
        base_host,
        allow_subdomains,
        scope_path,
        allowed_hosts,
        max_redirects,
        config,
        robots_rules,
        RetryContext::disabled(),
    )
    .await;
}
