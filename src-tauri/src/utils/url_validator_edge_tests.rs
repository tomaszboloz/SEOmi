use super::*;

#[test]
fn validator_covers_parse_scheme_and_password_edges() {
    assert!(matches!(
        validate_and_normalize_url("http://[::1"),
        Err(UrlValidationError::InvalidFormat(_))
    ));
    assert_eq!(
        validate_and_normalize_url("https://:secret@example.com"),
        Err(UrlValidationError::CredentialsNotAllowed)
    );
    assert_eq!(
        validate_and_normalize_url("http+unix://example.com"),
        Err(UrlValidationError::UnsupportedScheme("http+unix".into()))
    );
    assert!(!has_explicit_scheme("://example.com"));
    assert!(!has_explicit_scheme("ht*tp://example.com"));
}

#[test]
fn ipv4_policy_covers_special_ranges_and_nearby_public_values() {
    for address in [
        "0.0.0.0",
        "0.1.2.3",
        "10.0.0.1",
        "127.0.0.1",
        "169.254.1.1",
        "192.0.0.1",
        "192.0.2.1",
        "192.88.99.1",
        "198.18.0.1",
        "198.51.100.1",
        "203.0.113.1",
        "224.0.0.1",
        "241.0.0.1",
        "255.255.255.255",
        "100.64.0.1",
    ] {
        assert!(!is_public_ip(&address.parse().unwrap()), "{address}");
    }
    for address in [
        "1.1.1.1",
        "100.63.0.1",
        "100.128.0.1",
        "192.0.1.1",
        "192.88.98.1",
        "198.20.0.1",
        "198.51.99.1",
        "203.0.112.1",
    ] {
        assert!(is_public_ip(&address.parse().unwrap()), "{address}");
    }
}

#[test]
fn reserved_ranges_keep_public_neighbors_reachable() {
    for (blocked, adjacent_public) in [
        ("192.0.2.1", "192.0.1.1"),
        ("198.51.100.1", "198.51.99.1"),
        ("203.0.113.1", "203.0.112.1"),
    ] {
        let blocked_ip: IpAddr = blocked.parse().unwrap();
        let adjacent_ip: IpAddr = adjacent_public.parse().unwrap();
        let blocked_ipv4: std::net::Ipv4Addr = blocked.parse().unwrap();
        assert!(blocked_ipv4.is_documentation());
        assert!(
            !is_public_ip(&blocked_ip),
            "{blocked} must remain non-public"
        );
        assert!(
            is_public_ip(&adjacent_ip),
            "{adjacent_public} must remain public"
        );
    }

    for address in ["198.18.0.1", "198.19.0.1"] {
        assert!(!is_public_ip(&address.parse().unwrap()), "{address}");
    }
    assert!(is_public_ip(&"198.20.0.1".parse().unwrap()));
}

#[test]
fn ipv6_policy_covers_mapped_and_global_boundaries() {
    for address in [
        "::ffff:127.0.0.1",
        "2001::1",
        "2001:db8::1",
        "2002::1",
        "fc00::1",
    ] {
        assert!(!is_public_ip(&address.parse().unwrap()), "{address}");
    }
    for address in [
        "::ffff:1.1.1.1",
        "2001:200::1",
        "2000::1",
        "2606:4700:4700::1111",
    ] {
        assert!(is_public_ip(&address.parse().unwrap()), "{address}");
    }
    for address in ["::", "::ffff:0.0.0.0", "2001:0::1"] {
        assert!(!is_public_ip(&address.parse().unwrap()), "{address}");
    }
}
