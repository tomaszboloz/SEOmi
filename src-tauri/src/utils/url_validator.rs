use std::net::IpAddr;
use thiserror::Error;
use url::{Host, Url};

#[derive(Error, Debug, PartialEq, Eq)]
pub enum UrlValidationError {
    #[error("Empty URL provided")]
    EmptyUrl,
    #[error("Invalid URL format: {0}")]
    InvalidFormat(String),
    #[error("Unsupported scheme '{0}': only http and https are allowed")]
    UnsupportedScheme(String),
    #[error("Missing host in URL")]
    MissingHost,
    #[error("URLs containing embedded credentials are not allowed")]
    CredentialsNotAllowed,
    #[error("Access to local/private IP addresses is blocked for security (SSRF prevention)")]
    BlockedPrivateIp,
    #[error("Access to localhost or local network addresses is blocked")]
    BlockedLocalhost,
}

/// Validates and normalizes an input URL.
/// Enforces HTTP/HTTPS only and prevents SSRF to internal networks and localhost.
pub fn validate_and_normalize_url(input: &str) -> Result<Url, UrlValidationError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(UrlValidationError::EmptyUrl);
    }

    // Auto-prepend https:// only if no scheme is specified (no ://)
    let target = if !trimmed.contains("://") {
        format!("https://{}", trimmed)
    } else {
        trimmed.to_string()
    };

    let parsed =
        Url::parse(&target).map_err(|e| UrlValidationError::InvalidFormat(e.to_string()))?;

    // Validate scheme
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(UrlValidationError::UnsupportedScheme(scheme.to_string()));
    }

    // Validate host
    let host_str = parsed.host_str().ok_or(UrlValidationError::MissingHost)?;
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(UrlValidationError::CredentialsNotAllowed);
    }
    let host_lower = host_str.to_lowercase();

    // Check for localhost or local domain names
    if host_lower == "localhost"
        || host_lower.ends_with(".localhost")
        || host_lower.ends_with(".local")
        || host_lower.ends_with(".internal")
        || host_lower.ends_with(".lan")
    {
        return Err(UrlValidationError::BlockedLocalhost);
    }

    // Check if host is an IP address
    let literal_ip = match parsed.host() {
        Some(Host::Ipv4(ip)) => Some(IpAddr::V4(ip)),
        Some(Host::Ipv6(ip)) => Some(IpAddr::V6(ip)),
        _ => None,
    };
    if let Some(ip) = literal_ip {
        if is_private_or_loopback(&ip) {
            return Err(UrlValidationError::BlockedPrivateIp);
        }
    }

    Ok(parsed)
}

/// Returns whether an address is safe to contact as a public internet target.
/// This deliberately excludes special-purpose and non-routable ranges in
/// addition to the RFC1918/loopback ranges to keep DNS-resolved requests away
/// from local services and metadata endpoints.
pub fn is_public_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            let [a, b, c, _] = ipv4.octets();
            !(ipv4.is_loopback()
                || ipv4.is_private()
                || ipv4.is_link_local()
                || ipv4.is_broadcast()
                || ipv4.is_documentation()
                || ipv4.is_multicast()
                || ipv4.is_unspecified()
                || a == 0 // 0.0.0.0/8
                || a >= 240 // reserved and future-use space
                || (a == 100 && (64..=127).contains(&b)) // shared address space (100.64/10)
                || (a == 192 && b == 0 && c == 0) // protocol assignments
                || (a == 192 && b == 0 && c == 2) // documentation
                || (a == 192 && b == 88 && c == 99) // 6to4 relay anycast
                || (a == 198 && (b == 18 || b == 19)) // benchmarking
                || (a == 198 && b == 51 && c == 100) // documentation
                || (a == 203 && b == 0 && c == 113)) // documentation
        }
        IpAddr::V6(ipv6) => {
            if let Some(mapped) = ipv6.to_ipv4_mapped() {
                return is_public_ip(&IpAddr::V4(mapped));
            }
            let first = ipv6.segments()[0];
            let second = ipv6.segments()[1];
            !ipv6.is_loopback()
                && !ipv6.is_unspecified()
                && (first & 0xe000) == 0x2000 // Global unicast (2000::/3)
                && !(first == 0x2001 && second <= 0x01ff) // protocol assignment and documentation ranges
                && !(first == 0x2001 && second == 0x0db8) // documentation (2001:db8::/32)
                && first != 0x2002 // deprecated 6to4
        }
    }
}

fn is_private_or_loopback(ip: &IpAddr) -> bool {
    !is_public_ip(ip)
}

#[cfg(test)]
#[path = "url_validator_tests.rs"]
mod tests;

