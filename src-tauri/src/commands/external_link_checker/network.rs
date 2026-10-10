use super::concurrency::HostGates;
use super::models::{ExternalLinkCheck, DNS_TIMEOUT, REQUEST_TIMEOUT};
use crate::utils::url_validator::{is_public_ip, validate_and_normalize_url};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use std::net::SocketAddr;
use url::Url;

pub fn error_kind(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "timeout".into();
    }
    if error.is_connect() {
        let mut message = String::new();
        let mut cause = std::error::Error::source(error);
        while let Some(current) = cause {
            message.push_str(&current.to_string().to_ascii_lowercase());
            message.push(' ');
            cause = current.source();
        }
        if message.contains("dns") || message.contains("resolve") || message.contains("lookup") {
            return "dns".into();
        }
        if message.contains("tls")
            || message.contains("certificate")
            || message.contains("handshake")
        {
            return "tls".into();
        }
        return "connect".into();
    }
    "network".into()
}

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
    if !url.username().is_empty() || url.password().is_some() {
        return Err("URLs containing embedded credentials are not allowed".into());
    }
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
    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .resolve_to_addrs(host, addresses)
        .build()
        .map_err(|error| error.to_string())
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
