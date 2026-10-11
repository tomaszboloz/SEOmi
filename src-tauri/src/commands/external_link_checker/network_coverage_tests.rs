use super::{check_one, check_one_with_gates, checked_public_addresses, client_for_url, rejected};
use crate::commands::external_link_checker::concurrency::new_host_gates;
use std::net::SocketAddr;
use url::Url;

#[test]
fn rejected_constructs_proper_error_model() {
    let check = rejected("https://example.com/item".into(), "dns");
    assert_eq!(check.url, "https://example.com/item");
    assert_eq!(check.request_error_kind.as_deref(), Some("dns"));
    assert_eq!(check.http_status, None);
    assert_eq!(check.response_time_ms, None);
    assert_eq!(check.redirect_url, None);
    assert!(!check.checked_at.is_empty());
}

#[tokio::test]
async fn checked_public_addresses_handles_literals_and_unresolvable() {
    let ipv4 = Url::parse("http://1.1.1.1:80/path").unwrap();
    let addrs = checked_public_addresses(&ipv4).await.unwrap();
    assert_eq!(addrs, vec!["1.1.1.1:80".parse::<SocketAddr>().unwrap()]);

    let ipv6 = Url::parse("http://[2606:4700:4700::1111]:8080/").unwrap();
    let addrs6 = checked_public_addresses(&ipv6).await.unwrap();
    assert_eq!(
        addrs6,
        vec!["[2606:4700:4700::1111]:8080".parse::<SocketAddr>().unwrap()]
    );

    let no_host = Url::parse("file:///tmp/test").unwrap();
    assert_eq!(
        checked_public_addresses(&no_host).await.unwrap_err(),
        "URL has no host"
    );

    let no_port = Url::parse("custom://example.com").unwrap();
    assert_eq!(
        checked_public_addresses(&no_port).await.unwrap_err(),
        "URL has no HTTP port"
    );

    let unresolvable = Url::parse("http://seomi-unresolvable-nxdomain-9999.test/").unwrap();
    let err = checked_public_addresses(&unresolvable).await.unwrap_err();
    assert!(err.starts_with("DNS lookup failed") || err.contains("private or reserved address"));
}

#[tokio::test]
async fn client_for_url_handles_valid_and_missing_host() {
    let no_host = Url::parse("file:///local").unwrap();
    assert_eq!(
        client_for_url(&no_host, &[]).unwrap_err(),
        "URL has no host"
    );

    let valid = Url::parse("https://example.com/").unwrap();
    let addrs = vec![
        "1.1.1.1:443".parse().unwrap(),
        "1.0.0.1:443".parse().unwrap(),
    ];
    let client = client_for_url(&valid, &addrs);
    assert!(client.is_ok());
}

#[tokio::test]
async fn check_one_exercises_underlying_pipeline() {
    let nx = check_one("http://seomi-unresolvable-nxdomain-9999.test/".into()).await;
    assert!(matches!(
        nx.request_error_kind.as_deref(),
        Some("dns") | Some("blocked")
    ));

    let conn = check_one("http://8.8.8.8:1/test".into()).await;
    assert!(matches!(
        conn.request_error_kind.as_deref(),
        Some("connect") | Some("timeout")
    ));

    let blocked = check_one("http://127.0.0.1/".into()).await;
    assert_eq!(blocked.request_error_kind.as_deref(), Some("blocked"));
}

#[tokio::test]
async fn check_one_with_gates_exercises_underlying_pipeline() {
    let gates = new_host_gates();

    let nx = check_one_with_gates(
        "http://seomi-unresolvable-nxdomain-9999.test/".into(),
        gates.clone(),
    )
    .await;
    assert!(matches!(
        nx.request_error_kind.as_deref(),
        Some("dns") | Some("blocked")
    ));

    let conn = check_one_with_gates("http://8.8.8.8:1/test".into(), gates.clone()).await;
    assert!(matches!(
        conn.request_error_kind.as_deref(),
        Some("connect") | Some("timeout")
    ));

    let blocked = check_one_with_gates("http://192.168.1.1/".into(), gates.clone()).await;
    assert_eq!(blocked.request_error_kind.as_deref(), Some("blocked"));

    let invalid = check_one_with_gates("https://user:pass@example.com/".into(), gates).await;
    assert_eq!(invalid.request_error_kind.as_deref(), Some("invalid"));
}
