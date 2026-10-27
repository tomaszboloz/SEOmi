use super::fetch::fetch_with_resolver;
use super::models::{FetchOptions, FetchResult, MAX_BODY_BYTES};
use super::resolver::resolve_public_addresses;
use anyhow::Result;
use std::time::Duration;
use url::Url;

/// Custom redirect tracker to record each intermediate status code and location header
pub async fn fetch_page(
    target_url: &Url,
    user_agent_str: &str,
    timeout_secs: u64,
) -> Result<FetchResult> {
    fetch_page_with_options(target_url, user_agent_str, timeout_secs, 10, true).await
}

pub async fn fetch_page_with_options(
    target_url: &Url,
    user_agent_str: &str,
    timeout_secs: u64,
    max_redirects: usize,
    verify_ssl: bool,
) -> Result<FetchResult> {
    fetch_with_resolver(
        target_url,
        user_agent_str,
        FetchOptions {
            timeout: Duration::from_secs(timeout_secs),
            max_redirects: max_redirects.min(20),
            verify_ssl,
            max_body_bytes: MAX_BODY_BYTES,
        },
        |url| async move { resolve_public_addresses(&url).await },
    )
    .await
}

/// Bounded native fetch for registry evidence; caller supplies a much smaller body budget.
pub async fn fetch_registry_page(target_url: &Url) -> Result<FetchResult> {
    fetch_with_resolver(
        target_url,
        "SEOmi registry evidence/1.0",
        FetchOptions {
            timeout: Duration::from_secs(4),
            max_redirects: 3,
            verify_ssl: true,
            max_body_bytes: 512 * 1024,
        },
        |url| async move { resolve_public_addresses(&url).await },
    )
    .await
}
