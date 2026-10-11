use super::super::validation::{
    access_token, date_range, host_matches, metric, next_page_token, normalize_host, property_name,
    site_scope, stream_host, SiteScope,
};

#[test]
fn access_token_edges() {
    assert_eq!(access_token("  token-123  ").unwrap(), "token-123");
    assert_eq!(
        access_token("").unwrap_err(),
        "Google Analytics access token is missing."
    );
    assert_eq!(
        access_token("   \t\n  ").unwrap_err(),
        "Google Analytics access token is missing."
    );
}

#[test]
fn property_name_edges() {
    assert_eq!(property_name(" properties/123 ").unwrap(), "properties/123");
    assert!(property_name("properties/").is_err());
    assert!(property_name("properties/1234567890123456789012345").is_err());
    assert!(property_name("properties/12345abc").is_err());
    assert!(property_name("invalid/123").is_err());
    assert!(property_name("12345").is_err());
}

#[test]
fn date_range_edges() {
    assert_eq!(
        date_range("2026-01-01", "2026-01-02").unwrap(),
        ("2026-01-01".into(), "2026-01-02".into())
    );
    assert_eq!(
        date_range("invalid", "2026-01-02").unwrap_err(),
        "Google Analytics date range is invalid."
    );
    assert_eq!(
        date_range("2026-01-01", "invalid").unwrap_err(),
        "Google Analytics date range is invalid."
    );
    assert_eq!(
        date_range("2026-01-05", "2026-01-02").unwrap_err(),
        "Google Analytics date range is invalid."
    );
}

#[test]
fn site_scope_and_normalize_host_edges() {
    let domain = site_scope("sc-domain:Example.COM.").unwrap();
    assert_eq!(
        domain,
        SiteScope {
            host: "example.com".into(),
            domain_property: true,
        }
    );
    assert!(site_scope("sc-domain: bad host ").is_err());
    assert!(site_scope("sc-domain:foo/bar").is_err());
    assert!(site_scope("sc-domain:foo@bar").is_err());

    let url_scope = site_scope("https://Example.com/path").unwrap();
    assert_eq!(
        url_scope,
        SiteScope {
            host: "example.com".into(),
            domain_property: false,
        }
    );
    assert!(site_scope("ftp://example.com").is_err());
    assert!(site_scope("https://user@example.com").is_err());
    assert!(site_scope("https://:password@example.com").is_err());
    assert!(site_scope("https://").is_err());
    assert!(site_scope("https://example .com").is_err());
    assert!(site_scope("https://example.com:invalidport").is_err());
    assert!(site_scope("not a valid url").is_err());

    assert_eq!(normalize_host("  EXAMPLE.COM.  ").unwrap(), "example.com");
    assert!(normalize_host("").is_err());
    assert!(normalize_host("   ").is_err());
    assert!(normalize_host("...").is_err());
    assert!(normalize_host("host/path").is_err());
    assert!(normalize_host("user@host").is_err());
    assert!(normalize_host("host name").is_err());
}

#[test]
fn host_matches_and_stream_host_edges() {
    let domain = site_scope("sc-domain:example.com").unwrap();
    assert!(host_matches(&domain, "sub.example.com"));
    assert!(!host_matches(&domain, "badexample.com"));
    assert!(!host_matches(&domain, "bad host"));

    let prefix = site_scope("https://example.com").unwrap();
    assert!(!host_matches(&prefix, "sub.example.com"));

    assert_eq!(
        stream_host("https://example.com/stream").unwrap(),
        "example.com"
    );
    assert!(stream_host("not-a-url").is_err());
    assert!(stream_host("ftp://example.com").is_err());
    assert!(stream_host("file:///local/path").is_err());
    assert!(stream_host("https://").is_err());
    assert!(stream_host("https://example .com").is_err());
}

#[test]
fn pagination_and_metric_edges() {
    assert_eq!(next_page_token(None).unwrap(), None);
    assert_eq!(next_page_token(Some("".into())).unwrap(), None);
    assert_eq!(next_page_token(Some("   ".into())).unwrap(), None);
    assert_eq!(
        next_page_token(Some("valid-token".into())).unwrap(),
        Some("valid-token".into())
    );
    let long_token = "x".repeat(2049);
    assert_eq!(
        next_page_token(Some(long_token)).unwrap_err(),
        "Google Analytics returned an invalid pagination token."
    );

    assert_eq!(metric(Some("0")).unwrap(), 0.0);
    assert_eq!(metric(Some("123.45")).unwrap(), 123.45);
    assert!(metric(None).is_err());
    assert!(metric(Some("abc")).is_err());
    assert!(metric(Some("NaN")).is_err());
    assert!(metric(Some("inf")).is_err());
    assert!(metric(Some("-1")).is_err());
}
