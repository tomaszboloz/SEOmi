use super::concurrency::HostGates;
use super::models::{ExternalLinkCheck, DNS_TIMEOUT, REQUEST_TIMEOUT};
use crate::utils::url_validator::{is_public_ip, validate_and_normalize_url};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use std::net::SocketAddr;
use url::Url;

#[path = "network_error_kind.rs"]
mod classification;
pub use classification::error_kind;

#[cfg(test)]
pub fn rejected(url: String, kind: impl Into<String>) -> ExternalLinkCheck {
    ExternalLinkCheck {
        url,
        http_status: None,
        response_time_ms: None,
        redirect_url: None,
        request_error_kind: Some(kind.into()),
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}

pub fn normalize_external_url(input: &str) -> Result<Url, String> {
    let url = validate_and_normalize_url(input).map_err(|error| error.to_string())?;
    // The shared validator already rejects userinfo, so none can reach this point.
    debug_assert!(url.username().is_empty() && url.password().is_none());
    let mut url = url;
    url.set_fragment(None);
    Ok(url)
}

pub async fn checked_public_addresses(url: &Url) -> Result<Vec<SocketAddr>, String> {
    checked_public_addresses_with(url, |host, port| async move {
        tokio::net::lookup_host((host, port))
            .await
            .map(|items| items.collect())
    })
    .await
}

async fn checked_public_addresses_with<F, Fut>(
    url: &Url,
    resolve: F,
) -> Result<Vec<SocketAddr>, String>
where
    F: FnOnce(String, u16) -> Fut,
    Fut: std::future::Future<Output = std::io::Result<Vec<SocketAddr>>>,
{
    let host = url
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "URL has no HTTP port".to_string())?;
    let addresses = match url.host() {
        Some(url::Host::Ipv4(ip)) => vec![SocketAddr::new(ip.into(), port)],
        Some(url::Host::Ipv6(ip)) => vec![SocketAddr::new(ip.into(), port)],
        _ => tokio::time::timeout(DNS_TIMEOUT, resolve(host.to_owned(), port))
            .await
            .map_err(|_| "DNS lookup timed out".to_string())?
            .map_err(|error| format!("DNS lookup failed: {error}"))?,
    };
    if addresses.is_empty() {
        return Err("DNS returned no addresses".into());
    }
    if addresses.iter().any(|address| !is_public_ip(&address.ip())) {
        return Err("DNS resolved to a private or reserved address; request blocked".into());
    }
    Ok(addresses)
}

pub fn client_for_url(url: &Url, addresses: &[SocketAddr]) -> Result<reqwest::Client, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?;
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("SEOmi-LinkChecker/1.0 (+desktop SEO audit)"),
    );
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    finish_client(
        reqwest::Client::builder()
            .default_headers(headers)
            .timeout(REQUEST_TIMEOUT)
            .connect_timeout(REQUEST_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .resolve_to_addrs(host, addresses),
    )
}

pub(super) fn finish_client(builder: reqwest::ClientBuilder) -> Result<reqwest::Client, String> {
    builder.build().map_err(|error| error.to_string())
}

#[cfg(test)]
pub async fn check_one(input: String) -> ExternalLinkCheck {
    super::request::check_with(
        input,
        |url| async move { checked_public_addresses(&url).await },
        client_for_url,
    )
    .await
}

pub async fn check_one_with_gates(input: String, gates: HostGates) -> ExternalLinkCheck {
    super::request::check_with_gates(
        input,
        |url| async move { checked_public_addresses(&url).await },
        client_for_url,
        Some(gates),
    )
    .await
}

#[cfg(test)]
#[path = "network_edge_tests.rs"]
mod edge_tests;

#[cfg(test)]
#[path = "network_classification_tests.rs"]
mod classification_tests;

#[cfg(test)]
#[path = "network_coverage_tests.rs"]
mod coverage_tests;

#[cfg(test)]
#[path = "network_branch_tests.rs"]
mod network_branch_tests;
