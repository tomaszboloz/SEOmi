use super::{
    target::{authority_contains_userinfo, parse_proxy_target},
    types::ProxyTarget,
};

#[test]
fn non_get_head_connect_methods_return_405() {
    for method in ["POST", "PUT", "DELETE", "PATCH", "OPTIONS", "TRACE"] {
        assert!(matches!(
            parse_proxy_target(method.into(), "http://example.com/".into(), vec![], 0, &[]),
            Err(405)
        ));
    }
}

#[test]
fn connect_valid_and_invalid_targets() {
    assert!(matches!(
        parse_proxy_target("CONNECT".into(), "example.com:443".into(), vec![], 0, &[]),
        Ok(ProxyTarget::Connect { host, port }) if host == "example.com" && port == 443
    ));

    for bad_target in [
        "host:443?q=1",
        "host:443#frag",
        "user@host:443",
        "host:443/extra",
    ] {
        assert!(matches!(
            parse_proxy_target("CONNECT".into(), bad_target.into(), vec![], 0, &[]),
            Err(400)
        ));
    }

    assert!(matches!(
        parse_proxy_target("CONNECT".into(), "host:443".into(), vec![], 5, &[]),
        Err(400)
    ));
    assert!(matches!(
        parse_proxy_target("CONNECT".into(), "host:443".into(), vec![], 0, b"data"),
        Err(400)
    ));
}

#[test]
fn get_valid_and_invalid_targets() {
    assert!(matches!(
        parse_proxy_target(
            "GET".into(),
            "http://example.com/path".into(),
            vec![],
            0,
            &[]
        ),
        Ok(ProxyTarget::Http { method, .. }) if method == "GET"
    ));
    assert!(matches!(
        parse_proxy_target(
            "HEAD".into(),
            "http://example.com/path".into(),
            vec![],
            0,
            &[]
        ),
        Ok(ProxyTarget::Http { method, .. }) if method == "HEAD"
    ));

    for bad_url in [
        "https://example.com",
        "ftp://example.com",
        "http://user@example.com",
        "http://:pass@example.com",
        "http://user:pass@example.com",
    ] {
        assert!(matches!(
            parse_proxy_target("GET".into(), bad_url.into(), vec![], 0, &[]),
            Err(400)
        ));
    }

    assert!(matches!(
        parse_proxy_target("GET".into(), "http://example.com/".into(), vec![], 10, &[]),
        Err(400)
    ));
    assert!(matches!(
        parse_proxy_target(
            "GET".into(),
            "http://example.com/".into(),
            vec![],
            0,
            b"body"
        ),
        Err(400)
    ));
}

#[test]
fn authority_contains_userinfo_handles_various_formats() {
    assert!(!authority_contains_userinfo("example.com"));
    assert!(!authority_contains_userinfo("user@example.com"));
    assert!(!authority_contains_userinfo("/path/to/resource"));
    assert!(!authority_contains_userinfo(""));
    assert!(authority_contains_userinfo("http://user@example.com/"));
    assert!(authority_contains_userinfo("http://:pass@example.com/"));
    assert!(authority_contains_userinfo("http://user:pass@example.com/"));
    assert!(!authority_contains_userinfo("http://example.com/user@path"));
}
