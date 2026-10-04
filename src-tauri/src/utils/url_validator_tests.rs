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

#[test]
fn trailing_dot_local_names_are_blocked_like_their_canonical_form() {
    for input in [
        "http://localhost./",
        "https://printer.local./",
        "https://api.internal./x",
        "https://router.lan..",
    ] {
        assert_eq!(
            validate_and_normalize_url(input),
            Err(UrlValidationError::BlockedLocalhost),
            "{input}"
        );
    }
}

#[test]
fn scheme_less_input_with_url_in_query_still_gets_https() {
    let url = validate_and_normalize_url("example.com/login?next=https://example.com/a").unwrap();
    assert_eq!(url.scheme(), "https");
    assert_eq!(url.host_str(), Some("example.com"));
    assert_eq!(url.query(), Some("next=https://example.com/a"));
}

#[test]
fn explicit_non_http_schemes_stay_rejected() {
    assert_eq!(
        validate_and_normalize_url("ftp://example.com/"),
        Err(UrlValidationError::UnsupportedScheme("ftp".into()))
    );
    assert_eq!(
        validate_and_normalize_url("FILE:///etc/passwd"),
        Err(UrlValidationError::UnsupportedScheme("file".into()))
    );
}
