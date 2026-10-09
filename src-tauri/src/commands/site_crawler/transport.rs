use super::*;

#[cfg(test)]
use retry::{RetryContext, RetryError};

#[path = "transport_redirects.rs"]
mod redirects;

pub(crate) use redirects::request_with_safe_redirects_with_context;

pub(crate) fn crawler_client_builder() -> reqwest::ClientBuilder {
    crate::services::http_client::public_client_builder()
}

#[cfg(test)]
#[path = "transport_tests/mod.rs"]
mod tests;

pub(super) fn redirect_target_is_new(seen: &mut HashSet<String>, target: &str) -> bool {
    seen.insert(target.to_string())
}

pub(crate) fn crawl_deadline_reached(start_time: Instant, max_run_seconds: Option<u64>) -> bool {
    max_run_seconds
        .is_some_and(|seconds| start_time.elapsed() >= std::time::Duration::from_secs(seconds))
}

#[allow(clippy::too_many_arguments)]
#[cfg(test)]
pub(crate) async fn request_with_safe_redirects(
    client: &reqwest::Client,
    initial_url: &str,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
) -> Result<FetchedResponse, reqwest::Error> {
    request_with_safe_redirects_with_context(
        client,
        initial_url,
        base_host,
        allow_subdomains,
        scope_path,
        allowed_hosts,
        max_redirects,
        config,
        RetryContext::disabled(),
    )
    .await
    .map_err(RetryError::into_request)
}
