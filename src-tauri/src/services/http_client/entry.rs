use super::fetch::{fetch_with_resolver, fetch_with_resolver_policy};
use super::models::{FetchOptions, FetchResult, MAX_BODY_BYTES};
use super::resolver::resolve_public_addresses;
use anyhow::Result;
use std::time::Duration;
use url::Url;

const REGISTRY_USER_AGENT: &str = "SEOmi registry evidence/1.0";

fn official_host(host: &str) -> bool {
    ["pub.orcid.org", "www.wikidata.org"]
        .iter()
        .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

/// Registry requests are HTTPS-only and may not follow redirects off official APIs.
pub fn validate_registry_hop(url: &Url) -> Result<()> {
    if url.scheme() != "https" || url.port().is_some_and(|port| port != 443) {
        anyhow::bail!("registry API requires HTTPS on port 443");
    }
    if !url.username().is_empty() || url.password().is_some() {
        anyhow::bail!("registry API URL cannot contain credentials");
    }
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    if !official_host(&host) {
        anyhow::bail!("registry API host is not allow-listed");
    }
    Ok(())
}

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

pub async fn fetch_registry_page(target_url: &Url) -> Result<FetchResult> {
    fetch_with_resolver_policy(
        target_url,
        REGISTRY_USER_AGENT,
        FetchOptions {
            timeout: Duration::from_secs(4),
            max_redirects: 3,
            verify_ssl: true,
            max_body_bytes: 512 * 1024,
        },
        Some("application/json"),
        |url| async move { resolve_public_addresses(&url).await },
        validate_registry_hop,
    )
    .await
}
