use super::*;
use std::time::Duration;

#[tokio::test]
async fn client_head_timeout_is_classified_as_timeout() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (tx, rx) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        let (_stream, _) = listener.accept().await.unwrap();
        tx.send(()).unwrap();
        tokio::time::sleep(Duration::from_secs(5)).await;
    });

    let input = format!("http://seomi.test:{}/hang", address.port());
    let build = |url: &Url, addrs: &[SocketAddr]| {
        reqwest::Client::builder()
            .timeout(Duration::from_millis(50))
            .connect_timeout(Duration::from_millis(50))
            .resolve_to_addrs(url.host_str().unwrap(), addrs)
            .build()
            .map_err(|e| e.to_string())
    };

    let check_task = tokio::spawn(check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        build,
    ));

    rx.await.unwrap();
    let result = check_task.await.unwrap();
    assert_rejection(&result, &input, "timeout");
    server.abort();
}

#[tokio::test]
async fn fallback_get_timeout_is_classified_as_timeout() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream1, _) = listener.accept().await.unwrap();
        let mut buf = [0u8; 1024];
        let _ = stream1.read(&mut buf).await.unwrap();
        stream1
            .write_all(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        stream1.shutdown().await.unwrap();

        let (_stream2, _) = listener.accept().await.unwrap();
        tokio::time::sleep(Duration::from_secs(5)).await;
    });

    let input = format!("http://seomi.test:{}/fallback-hang", address.port());
    let build = |url: &Url, addrs: &[SocketAddr]| {
        reqwest::Client::builder()
            .timeout(Duration::from_millis(50))
            .connect_timeout(Duration::from_millis(50))
            .resolve_to_addrs(url.host_str().unwrap(), addrs)
            .build()
            .map_err(|e| e.to_string())
    };

    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        build,
    )
    .await;

    assert_rejection(&result, &input, "timeout");
    server.abort();
}

#[tokio::test]
async fn invalid_and_private_urls_classification_in_check_with() {
    for (url, expected) in [
        ("http://127.0.0.1/private", "blocked"),
        ("http://192.168.1.1/lan", "blocked"),
        ("http://10.0.0.1/corp", "blocked"),
        ("http://localhost/admin", "blocked"),
        ("http://service.local/api", "blocked"),
        ("https://user:pass@example.com/vault", "invalid"),
        ("ftp://files.example.com/", "invalid"),
        ("http://", "invalid"),
        ("", "invalid"),
        ("   ", "invalid"),
    ] {
        let result = check_with(
            url.into(),
            |_| async { panic!("must not resolve") },
            |_, _| panic!("must not build"),
        )
        .await;
        assert_rejection(&result, url, expected);
    }
}

#[tokio::test]
async fn fallback_get_on_501_not_implemented() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream1, _) = listener.accept().await.unwrap();
        let mut buf = [0u8; 1024];
        let _ = stream1.read(&mut buf).await.unwrap();
        stream1
            .write_all(
                b"HTTP/1.1 501 Not Implemented\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        stream1.shutdown().await.unwrap();

        let (mut stream2, _) = listener.accept().await.unwrap();
        let _ = stream2.read(&mut buf).await.unwrap();
        stream2
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        stream2.shutdown().await.unwrap();
    });

    let input = format!("http://seomi.test:{}/fallback-501", address.port());
    let build = |url: &Url, addrs: &[SocketAddr]| {
        reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .resolve_to_addrs(url.host_str().unwrap(), addrs)
            .build()
            .map_err(|e| e.to_string())
    };

    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        build,
    )
    .await;

    assert_eq!(result.http_status, Some(200));
    server.await.unwrap();
}
