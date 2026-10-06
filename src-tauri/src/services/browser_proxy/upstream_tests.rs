use super::upstream::{authority_for, connect_to_public_host, reason_phrase, request_target};
use std::io::ErrorKind;
use url::Url;

#[test]
fn proxy_url_helpers_cover_default_paths_and_authorities() {
    assert_eq!(
        request_target(&Url::parse("http://example.test").unwrap()),
        "/"
    );
    assert_eq!(
        request_target(&Url::parse("http://example.test/a?q=1").unwrap()),
        "/a?q=1"
    );
    assert_eq!(
        authority_for(&Url::parse("http://example.test").unwrap()),
        "example.test"
    );
    assert_eq!(
        authority_for(&Url::parse("http://example.test:8080").unwrap()),
        "example.test:8080"
    );
}

#[test]
fn unknown_statuses_use_the_generic_http_reason() {
    assert_eq!(reason_phrase(418), "Error");
    assert_eq!(reason_phrase(503), "Service Unavailable");
}

#[tokio::test]
async fn connector_rejects_private_numeric_addresses_without_connecting() {
    for host in ["127.0.0.1", "[127.0.0.1]", "[::1]"] {
        let error = connect_to_public_host(host, 80).await.unwrap_err();
        assert_eq!(error.kind(), ErrorKind::PermissionDenied, "{host}");
    }
}
