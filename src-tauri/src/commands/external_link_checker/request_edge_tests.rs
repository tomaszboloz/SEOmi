use super::{network::client_for_url, request::check_with};
use std::{net::SocketAddr, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[tokio::test]
async fn redirect_loop_detected_and_reported_as_unverifiable() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let port = address.port();
    let server = tokio::spawn(async move {
        for target in ["/loop-b", "/loop-a"] {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut req = [0u8; 1024];
            let _ = stream.read(&mut req).await.unwrap();
            let res = format!("HTTP/1.1 302 Found\r\nLocation: http://seomi.test:{port}{target}\r\nContent-Length: 0\r\n\r\n");
            stream.write_all(res.as_bytes()).await.unwrap();
        }
    });
    let input = format!("http://seomi.test:{port}/loop-a");
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.http_status, Some(302));
    assert_eq!(
        result.redirect_url.as_deref(),
        Some(&format!("http://seomi.test:{port}/loop-a")[..])
    );
    assert_eq!(result.request_error_kind.as_deref(), Some("unverifiable"));
}

#[tokio::test]
async fn exceeding_max_redirects_reported_as_unverifiable() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let port = address.port();
    let server = tokio::spawn(async move {
        for step in 1..=9 {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut req = [0u8; 1024];
            let _ = stream.read(&mut req).await.unwrap();
            let res = format!("HTTP/1.1 302 Found\r\nLocation: http://seomi.test:{port}/r{}\r\nContent-Length: 0\r\n\r\n", step + 1);
            stream.write_all(res.as_bytes()).await.unwrap();
        }
    });
    let input = format!("http://seomi.test:{port}/r1");
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.http_status, Some(302));
    assert_eq!(result.request_error_kind.as_deref(), Some("unverifiable"));
}

#[tokio::test]
async fn invalid_location_url_returns_unverifiable_redirect_failure() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut req = [0u8; 1024];
        let _ = stream.read(&mut req).await.unwrap();
        stream
            .write_all(
                b"HTTP/1.1 301 Moved\r\nLocation: javascript:void(0)\r\nContent-Length: 0\r\n\r\n",
            )
            .await
            .unwrap();
        stream.shutdown().await.unwrap();
    });
    let input = format!("http://seomi.test:{}/start", address.port());
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.http_status, Some(301));
    assert_eq!(result.request_error_kind.as_deref(), Some("unverifiable"));
}

#[tokio::test]
async fn dns_and_timeout_failures_after_redirect_preserve_redirect_target() {
    for err_msg in [
        "DNS lookup failed: not found",
        "DNS lookup timed out",
        "forbidden network",
    ] {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut req = [0u8; 1024];
            let _ = stream.read(&mut req).await.unwrap();
            stream.write_all(b"HTTP/1.1 302 Found\r\nLocation: http://next-target.test/dest\r\nContent-Length: 0\r\n\r\n").await.unwrap();
            stream.shutdown().await.unwrap();
        });
        let input = format!("http://seomi.test:{}/start", address.port());
        let result = check_with(
            input.clone(),
            move |target| {
                let err_msg = err_msg.to_string();
                async move {
                    if target.host_str() == Some("next-target.test") {
                        Err(err_msg)
                    } else {
                        Ok(vec![address])
                    }
                }
            },
            client_for_url,
        )
        .await;
        server.await.unwrap();
        assert_eq!(result.url, input);
        assert_eq!(result.http_status, None);
        assert_eq!(
            result.redirect_url.as_deref(),
            Some("http://next-target.test/dest")
        );
        assert_eq!(result.request_error_kind.as_deref(), Some("unverifiable"));
    }
}

#[tokio::test(start_paused = true)]
async fn overall_check_timeout_triggers_timeout_error() {
    let check = tokio::spawn(check_with(
        "http://seomi.test/hang".into(),
        |_| async {
            tokio::time::sleep(Duration::from_secs(45)).await;
            Ok(vec![SocketAddr::from(([93, 184, 216, 34], 80))])
        },
        client_for_url,
    ));
    tokio::time::advance(Duration::from_secs(35)).await;
    let result = check.await.unwrap();
    assert_eq!(result.url, "http://seomi.test/hang");
    assert_eq!(result.http_status, None);
    assert_eq!(result.request_error_kind.as_deref(), Some("timeout"));
}
