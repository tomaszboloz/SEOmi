use crate::models::audit_data::PageAuditData;
use crate::services::{http_client, seo_analyzer};
use anyhow::{anyhow, Result};
use std::future::Future;
use std::net::SocketAddr;
use std::time::Duration;
use url::Url;

fn fetch_options(
    timeout: Duration,
    max_redirects: usize,
    verify_ssl: bool,
) -> http_client::models::FetchOptions {
    http_client::models::FetchOptions {
        timeout,
        max_redirects: max_redirects.min(20),
        verify_ssl,
        max_body_bytes: http_client::models::MAX_BODY_BYTES,
    }
}

async fn public_resolver(url: Url) -> Result<Vec<SocketAddr>> {
    http_client::resolver::resolve_public_addresses(&url).await
}

pub(super) async fn fetch_and_analyze(
    validated_url: &Url,
    user_agent: &str,
    timeout_secs: u64,
    max_redirects: usize,
    verify_ssl: bool,
) -> Result<PageAuditData> {
    fetch_and_analyze_with_resolver(
        validated_url,
        user_agent,
        Duration::from_secs(timeout_secs),
        max_redirects,
        verify_ssl,
        public_resolver,
    )
    .await
}

pub(super) async fn fetch_and_analyze_with_resolver<R, F>(
    validated_url: &Url,
    user_agent: &str,
    timeout: Duration,
    max_redirects: usize,
    verify_ssl: bool,
    resolver: R,
) -> Result<PageAuditData>
where
    R: Fn(Url) -> F + Clone,
    F: Future<Output = Result<Vec<SocketAddr>>>,
{
    let request = if max_redirects == 10 && verify_ssl {
        http_client::fetch::fetch_with_resolver(
            validated_url,
            user_agent,
            fetch_options(timeout, 10, true),
            resolver.clone(),
        )
        .await
    } else {
        http_client::fetch::fetch_with_resolver(
            validated_url,
            user_agent,
            fetch_options(timeout, max_redirects, verify_ssl),
            resolver,
        )
        .await
    };
    analyze_fetch_result(request).await
}

pub(super) async fn analyze_fetch_result(
    request: Result<http_client::FetchResult>,
) -> Result<PageAuditData> {
    let fetch_result = request.map_err(|error| anyhow!("Network request failed: {error}"))?;
    seo_analyzer::analyze_page(fetch_result)
        .await
        .map_err(|error| anyhow!("SEO analysis failed: {error}"))
}
