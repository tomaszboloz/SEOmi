use super::network::{check_one, checked_public_addresses, client_for_url, rejected};
use std::net::SocketAddr;
use url::Url;

#[tokio::test]
async fn literal_addresses_are_resolved_without_dns_and_keep_ports() {
    for (input, expected) in [
        ("https://8.8.8.8/a", "8.8.8.8:443"),
        (
            "http://[2606:4700:4700::1111]:8080/a",
            "[2606:4700:4700::1111]:8080",
        ),
    ] {
        let addresses = checked_public_addresses(&Url::parse(input).unwrap())
            .await
            .unwrap();
        assert_eq!(addresses, vec![expected.parse::<SocketAddr>().unwrap()]);
    }
    for input in ["http://127.0.0.1", "http://[::1]", "http://[2001:db8::1]"] {
        assert_eq!(
            checked_public_addresses(&Url::parse(input).unwrap())
                .await
                .unwrap_err(),
            "DNS resolved to a private or reserved address; request blocked"
        );
    }
}

#[tokio::test]
async fn missing_host_and_unknown_port_are_contextual() {
    assert_eq!(
        checked_public_addresses(&Url::parse("file:///tmp/a").unwrap())
            .await
            .unwrap_err(),
        "URL has no host"
    );
    assert_eq!(
        checked_public_addresses(&Url::parse("custom://example.test").unwrap())
            .await
            .unwrap_err(),
        "URL has no HTTP port"
    );
    assert!(
        matches!(client_for_url(&Url::parse("file:///tmp/a").unwrap(), &[]), Err(error) if error == "URL has no host")
    );
}

#[tokio::test]
async fn rejected_and_check_one_keep_input_and_do_not_invent_measurements() {
    let direct = rejected("original".into(), "reason");
    assert_eq!(direct.url, "original");
    assert_eq!(direct.request_error_kind.as_deref(), Some("reason"));
    assert!(chrono::DateTime::parse_from_rfc3339(&direct.checked_at).is_ok());
    for (input, kind) in [
        ("ftp://example.test", "invalid"),
        ("http://127.0.0.1/path", "blocked"),
        ("http://localhost/", "blocked"),
        ("", "invalid"),
    ] {
        let result = check_one(input.into()).await;
        assert_eq!(result.url, input);
        assert_eq!(result.request_error_kind.as_deref(), Some(kind));
        assert_eq!(result.http_status, None);
        assert_eq!(result.response_time_ms, None);
        assert_eq!(result.redirect_url, None);
        assert!(chrono::DateTime::parse_from_rfc3339(&result.checked_at).is_ok());
    }
}

#[tokio::test]
async fn client_pins_dns_and_preserves_headers_and_nonfollowing_redirects() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut data = Vec::new();
        loop {
            let mut byte = [0];
            stream.read_exact(&mut byte).await.unwrap();
            data.push(byte[0]);
            if data.ends_with(b"\r\n\r\n") {
                break;
            }
            assert!(data.len() < 8192);
        }
        stream.write_all(b"HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await.unwrap();
        String::from_utf8(data).unwrap()
    });
    let url = Url::parse(&format!("http://seomi.test:{}/original", address.port())).unwrap();
    let client = client_for_url(&url, &[address]).unwrap();
    let response = client.head(url.clone()).send().await.unwrap();
    assert_eq!(response.status(), 302);
    assert_eq!(response.url(), &url);
    assert_eq!(response.headers()["location"], "/next");
    let request = task.await.unwrap().to_ascii_lowercase();
    assert!(request.starts_with("head /original http/1.1\r\n"));
    assert!(request.contains("user-agent: seomi-linkchecker/1.0 (+desktop seo audit)\r\n"));
    assert!(request.contains("accept: */*\r\n"));
    assert!(request.contains(&format!("host: seomi.test:{}\r\n", address.port())));
}

#[tokio::test]
async fn classifies_builder_and_signalled_timeout_errors() {
    use super::network::error_kind;
    use std::time::Duration;
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_millis(50))
        .build()
        .unwrap();
    let invalid = client.get("file:///tmp/a").send().await.unwrap_err();
    assert_eq!(error_kind(&invalid), "network");
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (accepted_tx, accepted_rx) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(async move {
        let (_stream, _) = listener.accept().await.unwrap();
        accepted_tx.send(()).unwrap();
        std::future::pending::<()>().await;
    });
    let request = tokio::spawn(async move {
        client
            .get(format!("http://{address}"))
            .send()
            .await
            .unwrap_err()
    });
    accepted_rx.await.unwrap();
    let error = request.await.unwrap();
    assert!(error.is_timeout());
    assert_eq!(error_kind(&error), "timeout");
    task.abort();
    assert!(task.await.unwrap_err().is_cancelled());
}
