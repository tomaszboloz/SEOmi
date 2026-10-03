use super::resolver::resolve_public_addresses;
use crate::utils::url_validator::validate_and_normalize_url;
use anyhow::{anyhow, Result};
use reqwest::redirect::Policy;
use std::future::Future;
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use url::Url;

/// Helper to check HTTP status of an external or internal link
pub async fn check_url_status(url_str: &str, timeout_secs: u64) -> Result<(u16, u64)> {
    let url = validate_and_normalize_url(url_str).map_err(|error| anyhow!(error.to_string()))?;
    check_status_with_resolver(&url, Duration::from_secs(timeout_secs), |url| async move {
        resolve_public_addresses(&url).await
    })
    .await
}

pub async fn check_status_with_resolver<R, F>(
    url: &Url,
    budget: Duration,
    resolve: R,
) -> Result<(u16, u64)>
where
    R: Fn(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>>>,
{
    timeout(budget, async {
        let host = url.host_str().ok_or_else(|| anyhow!("URL has no host"))?;
        let addresses = resolve(url.clone()).await?;
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .no_proxy()
            .resolve_to_addrs(host, &addresses)
            .build()?;
        let start = Instant::now();
        let response = client.head(url.clone()).send().await?;
        Ok((
            response.status().as_u16(),
            start.elapsed().as_millis() as u64,
        ))
    })
    .await
    .map_err(|_| anyhow!("HTTP operation timed out"))?
}
