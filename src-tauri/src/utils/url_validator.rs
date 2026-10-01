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
mod tests {
    use super::*;

    #[test]
    fn ipv6_literals_reject_local_and_special_addresses() {
        for target in [
            "http://[::1]/",
            "http://[fc00::1]/",
            "http://[fe80::1]/",
            "http://[::ffff:127.0.0.1]/",
            "http://[2001:db8::1]/",
        ] {
            assert_eq!(
                validate_and_normalize_url(target),
                Err(UrlValidationError::BlockedPrivateIp),
                "{target}"
            );
        }
        assert!(validate_and_normalize_url("https://[2606:4700:4700::1111]/").is_ok());
    }

    #[test]
    fn test_valid_https_url() {
        let res = validate_and_normalize_url("https://example.com/blog?q=test");
        assert!(res.is_ok());
        let url = res.unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("example.com"));
        assert_eq!(url.path(), "/blog");
    }

    #[test]
    fn test_missing_scheme_defaults_to_https() {
        let res = validate_and_normalize_url("github.com/rust-lang");
        assert!(res.is_ok());
        let url = res.unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("github.com"));
        assert_eq!(url.path(), "/rust-lang");
    }

    #[test]
    fn test_unsupported_scheme_rejected() {
        let res = validate_and_normalize_url("ftp://files.example.com");
        assert_eq!(
            res,
            Err(UrlValidationError::UnsupportedScheme("ftp".to_string()))
        );

        let file_res = validate_and_normalize_url("file:///etc/passwd");
        assert!(file_res.is_err());
    }

    #[test]
    fn test_empty_url_rejected() {
        let res = validate_and_normalize_url("   ");
        assert_eq!(res, Err(UrlValidationError::EmptyUrl));
    }

    #[test]
    fn test_localhost_blocked() {
        let res = validate_and_normalize_url("http://localhost:8080/admin");
        assert_eq!(res, Err(UrlValidationError::BlockedLocalhost));

        let sub_res = validate_and_normalize_url("http://app.localhost");
        assert_eq!(sub_res, Err(UrlValidationError::BlockedLocalhost));
    }

    #[test]
    fn test_private_ips_blocked_ssrf() {
        // 127.0.0.1 (Loopback)
        let loopback = validate_and_normalize_url("http://127.0.0.1:3000");
        assert_eq!(loopback, Err(UrlValidationError::BlockedPrivateIp));

        // 192.168.1.1 (RFC 1918)
        let rfc1918 = validate_and_normalize_url("http://192.168.1.1/setup");
        assert_eq!(rfc1918, Err(UrlValidationError::BlockedPrivateIp));

        // 10.0.0.5 (RFC 1918)
        let ten_net = validate_and_normalize_url("https://10.0.0.5");
        assert_eq!(ten_net, Err(UrlValidationError::BlockedPrivateIp));

        // 169.254.169.254 (Cloud metadata service)
        let metadata = validate_and_normalize_url("http://169.254.169.254/latest/meta-data");
        assert_eq!(metadata, Err(UrlValidationError::BlockedPrivateIp));
    }

    #[test]
    fn embedded_credentials_are_rejected_before_network_access() {
        assert_eq!(
            validate_and_normalize_url("https://user:secret@example.com"),
            Err(UrlValidationError::CredentialsNotAllowed)
        );
    }

    #[test]
    fn test_public_ip_policy_rejects_special_ranges() {
        for address in [
            "100.64.0.1",
            "192.0.0.8",
            "192.88.99.1",
            "198.18.0.1",
            "224.0.0.1",
            "2001:db8::1",
            "2001::1",
            "2002::1",
            "fc00::1",
            "fe80::1",
            "::ffff:127.0.0.1",
            "240.0.0.1",
        ] {
            let ip = address.parse().unwrap();
            assert!(
                !is_public_ip(&ip),
                "{address} must not be treated as public"
            );
        }
        for address in ["1.1.1.1", "2606:4700:4700::1111"] {
            let ip = address.parse().unwrap();
            assert!(is_public_ip(&ip), "{address} should be treated as public");
        }
    }
}
