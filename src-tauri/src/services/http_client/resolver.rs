use super::models::DNS_TIMEOUT;
use crate::utils::url_validator::is_public_ip;
use anyhow::{anyhow, Result};
use reqwest::redirect::Policy;
use std::future::Future;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use tokio::net::lookup_host;
use tokio::time::timeout;
use url::{Host, Url};

pub struct ValidatedResolver<R> {
    pub lookup: R,
}

impl<R, F> reqwest::dns::Resolve for ValidatedResolver<R>
where
    R: Fn(String) -> F + Send + Sync,
    F: Future<Output = std::io::Result<Vec<SocketAddr>>> + Send + 'static,
{
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let lookup = (self.lookup)(name.as_str().to_owned());
        Box::pin(async move {
            let addresses = timeout(DNS_TIMEOUT, lookup).await.map_err(|_| {
                std::io::Error::new(std::io::ErrorKind::TimedOut, "DNS lookup timed out")
            })??;
            let addresses = validate_addresses(addresses).map_err(|error| {
                std::io::Error::new(std::io::ErrorKind::PermissionDenied, error.to_string())
            })?;
            Ok(Box::new(addresses.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

pub fn public_client_builder_with_lookup<R, F>(lookup: R) -> reqwest::ClientBuilder
where
    R: Fn(String) -> F + Send + Sync + 'static,
    F: Future<Output = std::io::Result<Vec<SocketAddr>>> + Send + 'static,
{
    reqwest::Client::builder()
        .no_proxy()
        .redirect(Policy::none())
        .dns_resolver(Arc::new(ValidatedResolver { lookup }))
}

/// URLs must first pass validate_and_normalize_url, which checks literal IPs.
/// DNS names are resolved only once per connection and every answer is checked.
/// Ambient proxies are disabled; an explicit user proxy is an opt-in boundary.
pub fn public_client_builder() -> reqwest::ClientBuilder {
    public_client_builder_with_lookup(|host| async move {
        Ok(lookup_host((host.as_str(), 0)).await?.collect())
    })
}

pub async fn resolve_public_addresses(url: &Url) -> Result<Vec<SocketAddr>> {
    let host = url.host().ok_or_else(|| anyhow!("URL has no host"))?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow!("URL has no HTTP port"))?;
    let domain = match host {
        Host::Ipv4(ip) => return validate_addresses(vec![SocketAddr::new(IpAddr::V4(ip), port)]),
        Host::Ipv6(ip) => return validate_addresses(vec![SocketAddr::new(IpAddr::V6(ip), port)]),
        Host::Domain(domain) => domain,
    };
    let addresses = timeout(DNS_TIMEOUT, lookup_host((domain, port)))
        .await
        .map_err(|_| anyhow!("DNS lookup timed out"))?
        .map_err(|error| anyhow!("DNS lookup failed: {error}"))?
        .collect::<Vec<_>>();
    validate_addresses(addresses)
}

pub fn validate_addresses(addresses: Vec<SocketAddr>) -> Result<Vec<SocketAddr>> {
    if addresses.is_empty() {
        return Err(anyhow!("DNS returned no addresses"));
    }
    if addresses.iter().any(|address| !is_public_ip(&address.ip())) {
        return Err(anyhow!(
            "DNS resolved to a private or reserved address; request blocked"
        ));
    }
    Ok(addresses)
}
