use super::fetch::{fetch_with_resolver, fetch_with_resolver_accept};
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
    fetch_with_resolver_accept(
        target_url,
        "SEOmi registry evidence/1.0",
        FetchOptions {
            timeout: Duration::from_secs(4),
            max_redirects: 3,
            verify_ssl: true,
            max_body_bytes: 512 * 1024,
        },
        Some("application/json"),
        |url| async move {
            validate_registry_hop(&url)?;
            resolve_public_addresses(&url).await
        },
    )
    .await
}

fn validate_registry_hop(url: &Url) -> Result<()> {
    let host = url
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.");
    let allowed = [
        "orcid.org",
        "wikidata.org",
        "scholar.google.com",
        "researchgate.net",
        "scopus.com",
    ]
    .iter()
    .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")));
    if url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || !allowed
    {
        anyhow::bail!("Unsafe registry redirect blocked");
    }
    Ok(())
}

#[cfg(test)]
mod registry_tests {
    use super::validate_registry_hop;
    use url::Url;

    #[test]
    fn every_registry_hop_requires_a_trusted_https_origin() {
        for url in [
            "https://orcid.org/id",
            "https://www.wikidata.org/wiki/Q42",
            "https://researchgate.net/profile/a",
            "https://scholar.google.com/citations?user=a",
            "https://scopus.com/authid/detail.uri",
            "https://sub.orcid.org/id",
        ] {
            assert!(
                validate_registry_hop(&Url::parse(url).unwrap()).is_ok(),
                "{url}"
            );
        }
        for url in [
            "http://orcid.org/id",
            "https://orcid.org:8443/id",
            "https://user@orcid.org/id",
            "https://:secret@orcid.org/id",
            "https://orcid.org.evil.test/id",
            "https://example.com/id",
            "file:///id",
        ] {
            assert!(
                validate_registry_hop(&Url::parse(url).unwrap()).is_err(),
                "{url}"
            );
        }
    }
}
