use super::{check_link, check_link_with_status};
use crate::services::http_client::status::check_status_with_resolver;
use std::{net::SocketAddr, time::Duration};
use tokio::{io::AsyncReadExt, io::AsyncWriteExt, net::TcpListener};
use url::Url;

#[tokio::test]
async fn link_status_rejects_local_and_credential_urls_before_network() {
    for url in [
        "http://127.0.0.1/private",
        "https://user:password@example.com/secret",
        "file:///tmp/report.html",
    ] {
        let error = check_link(url.into(), Some(999)).await.unwrap_err();
        assert!(error.starts_with("Invalid link URL:"), "{error}");
    }
}

#[tokio::test]
async fn link_status_checks_local_fixture_through_the_validated_resolver() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = [0; 1024];
        let bytes = stream.read(&mut request).await.unwrap();
        assert!(bytes > 0, "fixture must receive the HTTP request");
        stream
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
    });
    let result = check_link_with_status(
        "http://fixture.test".into(),
        Some(0),
        |url, timeout| async move {
            assert_eq!(url, "http://fixture.test/");
            assert_eq!(timeout, 1);
            check_status_with_resolver(
                &Url::parse(&url).unwrap(),
                Duration::from_secs(timeout),
                move |_url| async move { Ok::<Vec<SocketAddr>, anyhow::Error>(vec![address]) },
            )
            .await
        },
    )
    .await
    .unwrap();
    server.await.unwrap();
    assert_eq!(result.status, 204);
    assert_eq!(result.url, "http://fixture.test");
    assert!(!result.is_broken);
}

#[tokio::test]
async fn link_result_preserves_status_and_timing_and_clamps_budgets() {
    for (status, broken, supplied, budget) in [
        (200, false, None, 5),
        (399, false, Some(15), 15),
        (400, true, Some(999), 15),
        (503, true, Some(1), 1),
    ] {
        let result = check_link_with_status(
            "https://example.com/path".into(),
            supplied,
            |url, timeout| async move {
                assert_eq!(url, "https://example.com/path");
                assert_eq!(timeout, budget);
                Ok((status, 42))
            },
        )
        .await
        .unwrap();
        assert_eq!(
            (result.status, result.response_time_ms, result.is_broken),
            (status, 42, broken)
        );
    }
    let result = check_link_with_status("https://example.com/".into(), None, |_, _| async {
        Err(anyhow::anyhow!("fixture connection failure"))
    })
    .await
    .unwrap();
    assert_eq!(
        (result.status, result.response_time_ms, result.is_broken),
        (0, 0, true)
    );
}

#[tokio::test]
async fn invalid_links_never_invoke_the_status_transport() {
    let called = std::cell::Cell::new(false);
    let error = check_link_with_status("file:///private/secret".into(), None, |_, _| {
        called.set(true);
        std::future::ready(Ok((200, 0)))
    })
    .await
    .unwrap_err();
    assert!(error.starts_with("Invalid link URL:"));
    assert!(!called.get());
}

#[tokio::test]
async fn check_link_executes_outer_transport_wrapper() {
    let result = check_link("https://nonexistent.invalid".into(), Some(1))
        .await
        .unwrap();
    assert_eq!(result.status, 0);
    assert!(result.is_broken);
}
