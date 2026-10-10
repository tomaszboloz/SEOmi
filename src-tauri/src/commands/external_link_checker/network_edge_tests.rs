use super::{checked_public_addresses, normalize_external_url};
use std::net::{IpAddr, SocketAddr};
use url::Url;

#[tokio::test]
async fn dns_failures_are_reported_without_fabricating_addresses() {
    let url = Url::parse("https://seomi-invalid-host.invalid/").unwrap();
    let error = super::checked_public_addresses_with(&url, |host, port| async move {
        assert_eq!(host, "seomi-invalid-host.invalid");
        assert_eq!(port, 443);
        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "fixture lookup failure",
        ))
    })
    .await
    .unwrap_err();
    assert_eq!(error, "DNS lookup failed: fixture lookup failure");
}

#[test]
fn normalization_removes_fragments_and_keeps_public_ip_literals() {
    let url = normalize_external_url("https://8.8.8.8/path#private-fragment").unwrap();
    assert_eq!(url.fragment(), None);
    assert_eq!(
        url.host(),
        Some(url::Host::Ipv4("8.8.8.8".parse().unwrap()))
    );
    assert!(matches!(url.host(), Some(url::Host::Ipv4(ip)) if IpAddr::V4(ip).is_ipv4()));
}

#[test]
fn normalization_rejects_embedded_credentials() {
    assert!(normalize_external_url("https://user:pass@example.com/").is_err());
    assert!(normalize_external_url("https://user@example.com/").is_err());
}

#[tokio::test]
async fn check_one_rejects_embedded_credentials() {
    let res = super::check_one("https://user:pass@example.com/".into()).await;
    assert_eq!(res.request_error_kind.as_deref(), Some("invalid"));
}

#[tokio::test]
async fn checked_public_addresses_handles_ip_literals_and_private_blocking() {
    let url_v4 = Url::parse("https://8.8.8.8/").unwrap();
    let addrs_v4 = checked_public_addresses(&url_v4).await.unwrap();
    assert_eq!(addrs_v4.len(), 1);

    let url_v6 = Url::parse("https://[2001:4860:4860::8888]/").unwrap();
    let addrs_v6 = checked_public_addresses(&url_v6).await.unwrap();
    assert_eq!(addrs_v6.len(), 1);

    let url_priv = Url::parse("https://127.0.0.1/").unwrap();
    assert!(checked_public_addresses(&url_priv).await.is_err());

    let client = super::client_for_url(&url_v4, &addrs_v4).unwrap();
    drop(client);
}

#[tokio::test]
async fn empty_and_private_resolver_results_are_rejected() {
    let url = Url::parse("https://dns.example/").unwrap();
    assert_eq!(
        super::checked_public_addresses_with(&url, |_, _| async { Ok(vec![]) })
            .await
            .unwrap_err(),
        "DNS returned no addresses"
    );
    assert_eq!(
        super::checked_public_addresses_with(&url, |_, _| async {
            Ok(vec!["127.0.0.1:443".parse().unwrap()])
        })
        .await
        .unwrap_err(),
        "DNS resolved to a private or reserved address; request blocked"
    );
}

#[tokio::test(start_paused = true)]
async fn resolver_timeout_is_reported_after_the_configured_deadline() {
    let url = Url::parse("https://dns.fixture/").unwrap();
    let task = tokio::spawn(async move {
        super::checked_public_addresses_with(&url, |_, _| async {
            std::future::pending::<std::io::Result<Vec<SocketAddr>>>().await
        })
        .await
    });

    tokio::task::yield_now().await;
    tokio::time::advance(super::DNS_TIMEOUT + std::time::Duration::from_millis(1)).await;
    assert_eq!(task.await.unwrap().unwrap_err(), "DNS lookup timed out");
}

#[tokio::test]
async fn resolver_fixture_receives_hostname_and_explicit_port() {
    let url = Url::parse("https://dns.fixture:8443/a").unwrap();
    let result = super::checked_public_addresses_with(&url, |host, port| async move {
        assert_eq!(host, "dns.fixture");
        assert_eq!(port, 8443);
        Ok(vec!["8.8.8.8:8443".parse().unwrap()])
    })
    .await
    .unwrap();

    assert_eq!(result, vec!["8.8.8.8:8443".parse().unwrap()]);
}

#[tokio::test]
async fn public_resolver_wrapper_uses_local_fixture_without_external_network() {
    let url = Url::parse("http://localhost/").unwrap();
    let error = checked_public_addresses(&url).await.unwrap_err();
    assert_eq!(
        error,
        "DNS resolved to a private or reserved address; request blocked"
    );
}
