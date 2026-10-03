use super::parse::{find_header_end, parse_proxy_target, parse_request_head};
use super::types::{is_allowed_plain_http_port, ProxyTarget};
use super::upstream::{is_local_hostname, request_target};

#[test]
fn local_and_metadata_names_are_rejected_before_dns() {
    for host in [
        "localhost",
        "router.local",
        "service.internal",
        "db.lan",
        "metadata.google.internal",
    ] {
        assert!(is_local_hostname(host), "{host} should be blocked");
    }
    assert!(!is_local_hostname("example.com"));
}

#[test]
fn request_parser_accepts_only_unambiguous_bounded_headers() {
    let parsed = parse_request_head(
        "GET http://example.com/a?q=1 HTTP/1.1\r\nHost: example.com\r\nContent-Length: 0",
    )
    .unwrap();
    assert_eq!(parsed.method, "GET");
    assert_eq!(parsed.content_length, 0);

    for malformed in [
        "GET http://example.com/ HTTP/1.1\r\nContent-Length: 0\r\nContent-Length: 0",
        "GET http://example.com/ HTTP/1.1\r\nTransfer-Encoding: chunked",
        "GET http://example.com/ HTTP/1.1\r\nExpect: 100-continue",
        "GET http://example.com/ HTTP/1.1\r\nBad Header: value",
        "GET http://example.com/ HTTP/1.1\r\nX-Test: ok\u{007f}bad",
        "GET http://example.com/ HTTP/1.1\r\nContent-Length: 1048577",
        "GET http://example.com/ HTTP/1.1 EXTRA",
        "GE\u{0001}T http://example.com/ HTTP/1.1",
    ] {
        assert!(
            parse_request_head(malformed).is_err(),
            "accepted {malformed:?}"
        );
    }
    assert_eq!(
        parse_request_head("POST http://example.com/ HTTP/1.1").unwrap_err(),
        405
    );
}

#[test]
fn proxy_targets_reject_credentials_schemes_and_bodies() {
    let valid = parse_proxy_target(
        "GET".into(),
        "http://example.com/a?q=1".into(),
        Vec::new(),
        0,
        &[],
    )
    .unwrap();
    match valid {
        ProxyTarget::Http { url, .. } => assert_eq!(request_target(&url), "/a?q=1"),
        ProxyTarget::Connect { .. } => panic!("expected HTTP request"),
    }

    for target in [
        "file:///etc/passwd",
        "http://user:secret@example.com/",
        "http://@example.com/",
    ] {
        assert!(parse_proxy_target("GET".into(), target.into(), Vec::new(), 0, &[]).is_err());
    }
    assert!(parse_proxy_target(
        "GET".into(),
        "http://example.com/".into(),
        Vec::new(),
        1,
        b"x"
    )
    .is_err());
    assert!(parse_proxy_target(
        "CONNECT".into(),
        "@example.com:443".into(),
        Vec::new(),
        0,
        &[]
    )
    .is_err());
}

#[test]
fn only_common_web_ports_are_allowed_for_plain_http() {
    assert!(is_allowed_plain_http_port(80));
    assert!(is_allowed_plain_http_port(8080));
    for denied in [22, 443, 2375, 3000, 8443] {
        assert!(
            !is_allowed_plain_http_port(denied),
            "port {denied} must be denied"
        );
    }
}

#[test]
fn request_header_terminator_is_detected_without_accepting_partial_headers() {
    assert_eq!(
        find_header_end(b"GET http://example.com/ HTTP/1.1\r\n"),
        None
    );
    assert!(find_header_end(b"GET http://example.com/ HTTP/1.1\r\n\r\n").is_some());
}
