use super::upstream::connect_to_public_host_with;
use super::upstream::{
    authority_for, connect_to_public_host, is_local_hostname, reason_phrase, request_target,
};
use std::io::{self, ErrorKind};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::time::sleep;
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
    for host in [
        "localhost",
        "api.LOCALHOST.",
        "printer.local",
        "svc.internal",
        "router.lan",
        "metadata.google.internal",
    ] {
        assert!(is_local_hostname(host), "{host}");
    }
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

#[tokio::test]
async fn connector_preserves_resolver_failures() {
    let error = connect_to_public_host_with(
        "unresolved.example",
        443,
        |_, _| async { Err(io::Error::new(ErrorKind::NotFound, "DNS failed")) },
        |_| async { Err(io::Error::other("connector must not run")) },
        Duration::from_secs(1),
    )
    .await
    .unwrap_err();
    assert_eq!(error.kind(), ErrorKind::NotFound);
}

#[tokio::test]
async fn connector_rejects_empty_and_private_dns_results() {
    for addresses in [Vec::new(), vec![SocketAddr::from(([127, 0, 0, 1], 443))]] {
        let error = connect_to_public_host_with(
            "mixed.example",
            443,
            move |_, _| {
                let addresses = addresses.clone();
                async move { Ok(addresses) }
            },
            |_| async { Err(io::Error::other("connector must not run")) },
            Duration::from_secs(1),
        )
        .await
        .unwrap_err();
        assert_eq!(error.kind(), ErrorKind::PermissionDenied);
    }
}

#[tokio::test]
async fn connector_filters_private_dns_before_local_transport() {
    let (fixture, task) = super::server_fixture::tunnel_fixture(b"ok").await;
    let private = SocketAddr::from(([127, 0, 0, 1], fixture.port()));
    let public = SocketAddr::from(([8, 8, 8, 8], 443));
    let mut stream = connect_to_public_host_with(
        "mixed.example",
        443,
        move |_, _| async move { Ok(vec![private, public]) },
        move |address| async move {
            assert_eq!(address, public);
            tokio::net::TcpStream::connect(fixture).await
        },
        Duration::from_secs(1),
    )
    .await
    .unwrap();
    let mut response = [0; 2];
    stream.read_exact(&mut response).await.unwrap();
    assert_eq!(&response, b"ok");
    task.await.unwrap();
}

#[tokio::test]
async fn connector_timeout_is_reported_without_external_network() {
    let error = connect_to_public_host_with(
        "slow.example",
        443,
        |_, _| async { Ok(vec![SocketAddr::from(([8, 8, 8, 8], 443))]) },
        |_| async {
            sleep(Duration::from_millis(20)).await;
            Err(io::Error::other("late connector"))
        },
        Duration::from_millis(1),
    )
    .await
    .unwrap_err();
    assert_eq!(error.kind(), ErrorKind::TimedOut);
}
