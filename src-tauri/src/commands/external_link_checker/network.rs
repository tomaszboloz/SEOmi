use super::models::{ExternalLinkCheck, DNS_TIMEOUT, REQUEST_TIMEOUT};
use crate::utils::url_validator::{is_public_ip, validate_and_normalize_url};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, LOCATION, RANGE, USER_AGENT};
use std::net::SocketAddr;
use std::time::Instant;
use url::Url;

pub fn error_kind(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "timeout".into();
    }
    if error.is_connect() {
        let message = error.to_string().to_ascii_lowercase();
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
    let host = url
        .host_str()
        .ok_or_else(|| "URL has no host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "URL has no HTTP port".to_string())?;
    let lookup = tokio::time::timeout(DNS_TIMEOUT, tokio::net::lookup_host((host, port)))
        .await
        .map_err(|_| "DNS lookup timed out".to_string())?
        .map_err(|error| format!("DNS lookup failed: {error}"))?;
    let addresses = lookup.collect::<Vec<_>>();
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

pub async fn check_one(input: String) -> ExternalLinkCheck {
    let url = match normalize_external_url(&input) {
        Ok(url) => url,
        Err(error) => {
            let kind = if error.contains("local/private") || error.contains("local network") {
                "blocked"
            } else {
                "invalid"
            };
            return rejected(input, kind);
        }
    };
    let normalized = url.to_string();
    let addresses = match checked_public_addresses(&url).await {
        Ok(addresses) => addresses,
        Err(error) if error.starts_with("DNS lookup failed") => return rejected(normalized, "dns"),
        Err(error) if error.contains("timed out") => return rejected(normalized, "timeout"),
        Err(_) => return rejected(normalized, "blocked"),
    };
    let client = match client_for_url(&url, &addresses) {
        Ok(client) => client,
        Err(_) => return rejected(normalized, "network"),
    };

    let started = Instant::now();
    let response = match client.head(url.clone()).send().await {
        Ok(response) if response.status().as_u16() == 405 || response.status().as_u16() == 501 => {
            let request = client.get(url.clone()).header(RANGE, "bytes=0-0");
            match request.send().await {
                Ok(response) => response,
                Err(error) => return rejected(normalized, error_kind(&error)),
            }
        }
        Ok(response) => response,
        Err(error) => return rejected(normalized, error_kind(&error)),
    };
    let elapsed = started.elapsed().as_millis() as u64;
    let status = response.status().as_u16();
    let redirect_url = response
        .headers()
        .get(LOCATION)
        .and_then(|location| location.to_str().ok())
        .and_then(|location| url.join(location).ok())
        .map(|target| target.to_string());
    ExternalLinkCheck {
        url: normalized,
        http_status: Some(status),
        response_time_ms: Some(elapsed),
        redirect_url,
        request_error_kind: None,
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}
