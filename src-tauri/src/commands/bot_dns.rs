use std::net::IpAddr;
use std::time::Duration;

use crate::utils::url_validator::is_public_ip;

const DNS_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_HOST_LEN: usize = 253;
const MAX_LABEL_LEN: usize = 63;

fn parse_public_ip(value: &str) -> Result<IpAddr, String> {
    let ip: IpAddr = value.trim().parse().map_err(|_| "Invalid IP address")?;
    if !is_public_ip(&ip) {
        return Err("Only public IP addresses can be verified".into());
    }
    Ok(ip)
}

fn valid_host(host: &str) -> bool {
    let host = host.strip_suffix('.').unwrap_or(host);
    host.len() <= MAX_HOST_LEN
        && host.contains('.')
        && host.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= MAX_LABEL_LEN
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
}

async fn bounded<T: Send + 'static>(
    job: impl FnOnce() -> std::io::Result<T> + Send + 'static,
) -> Result<T, String> {
    tokio::time::timeout(DNS_TIMEOUT, tokio::task::spawn_blocking(job))
        .await
        .map_err(|_| "DNS lookup timed out")?
        .map_err(|_| "DNS lookup failed")?
        .map_err(|_| "DNS lookup failed".to_string())
}

/// PTR lookup for a public IP found in a server log. Private and special addresses are refused, so a
/// crafted log line cannot make the app probe internal resolvers.
#[tauri::command]
pub async fn dns_reverse(ip: String) -> Result<Vec<String>, String> {
    let ip = parse_public_ip(&ip)?;
    let name = bounded(move || dns_lookup::lookup_addr(&ip)).await?;
    Ok(vec![name])
}

/// A/AAAA lookup of a verified-crawler host name. Only public addresses are returned.
#[tauri::command]
pub async fn dns_forward(host: String) -> Result<Vec<String>, String> {
    if !valid_host(host.trim()) {
        return Err("Invalid host name".into());
    }
    let host = host.trim().to_owned();
    let addresses = bounded(move || dns_lookup::lookup_host(&host)).await?;
    Ok(addresses
        .into_iter()
        .filter(is_public_ip)
        .map(|address| address.to_string())
        .collect())
}

#[cfg(test)]
#[path = "bot_dns_tests.rs"]
mod tests;
