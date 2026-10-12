use super::upstream::{connect_to_public_host, reason_phrase, request_target, resolve_host};

#[test]
fn every_rejection_status_has_a_reason_phrase() {
    for (status, phrase) in [
        (400, "Bad Request"),
        (403, "Forbidden"),
        (405, "Method Not Allowed"),
        (408, "Request Timeout"),
        (413, "Payload Too Large"),
        (431, "Request Header Fields Too Large"),
        (502, "Bad Gateway"),
        (503, "Service Unavailable"),
        (418, "Error"),
    ] {
        assert_eq!(reason_phrase(status), phrase);
    }
}

#[tokio::test]
async fn default_resolver_failures_never_become_connections() {
    // The reserved `.invalid` TLD never resolves, so this exercises the system
    // resolver closure without any network dependency.
    let error = connect_to_public_host("seomi-test.invalid", 80)
        .await
        .unwrap_err();
    assert!(!error.to_string().is_empty());
}

#[tokio::test]
async fn the_system_resolver_returns_literal_addresses_without_dns() {
    let addresses = resolve_host("127.0.0.1".into(), 8080).await.unwrap();
    assert_eq!(addresses, vec!["127.0.0.1:8080".parse().unwrap()]);
}

#[test]
fn urls_without_a_path_are_forwarded_as_the_root_target() {
    let url = url::Url::parse("data:").unwrap();
    assert_eq!(request_target(&url), "/");
}
