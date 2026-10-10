use super::{
    entry::fetch_page_with_options,
    fetch::fetch_with_resolver,
    resolver::validate_addresses,
    status::{check_status_with_resolver, check_url_status},
    tests_common::{fixture, options},
};
use anyhow::anyhow;
use std::time::Duration;
use url::Url;

#[tokio::test]
async fn resolver_dns_failure_propagates_error() {
    let url = Url::parse("http://audit.example/").unwrap();
    let err = fetch_with_resolver(&url, "Test", options(5, 0), |_| async {
        Err(anyhow!("DNS lookup failed: NXDOMAIN"))
    })
    .await
    .unwrap_err();
    assert!(err.to_string().contains("DNS lookup failed"));
}

#[tokio::test]
async fn resolver_private_ip_is_blocked_on_all_ports() {
    let url = Url::parse("http://audit.example:8080/").unwrap();
    let err = fetch_with_resolver(&url, "Test", options(5, 0), |_| async {
        validate_addresses(vec!["192.168.1.1:8080".parse().unwrap()])
    })
    .await
    .unwrap_err();
    assert!(err.to_string().contains("private or reserved"));
}

#[tokio::test]
async fn supports_all_redirect_status_codes_and_records_chain() {
    let address = fixture(vec![
        "HTTP/1.1 303 See Other\r\nLocation: /step2\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
        "HTTP/1.1 307 Temporary Redirect\r\nLocation: /step3\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
        "HTTP/1.1 308 Permanent Redirect\r\nLocation: /final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
        "HTTP/1.1 200 OK\r\nContent-Length: 4\r\nConnection: close\r\n\r\ndone".into(),
    ])
    .await;
    let url = Url::parse(&format!("http://audit.example:{}/start", address.port())).unwrap();
    let result = fetch_with_resolver(&url, "Test", options(16, 5), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap();
    assert_eq!(result.status, 200);
    assert_eq!(result.body, "done");
    assert_eq!(result.redirect_chain.len(), 3);
    assert_eq!(result.redirect_chain[0].status_code, 303);
    assert_eq!(result.redirect_chain[1].status_code, 307);
    assert_eq!(result.redirect_chain[2].status_code, 308);
}

#[tokio::test]
async fn malformed_redirect_location_url_returns_error() {
    let address = fixture(vec![
        "HTTP/1.1 302 Found\r\nLocation: http://[\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
    ])
    .await;
    let url = Url::parse(&format!("http://audit.example:{}/start", address.port())).unwrap();
    let err = fetch_with_resolver(&url, "Test", options(16, 2), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap_err();
    assert!(!err.to_string().is_empty());
}

#[tokio::test]
async fn stream_truncation_during_body_read_fails() {
    let address = fixture(vec![
        "HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\ntruncated".into(),
    ])
    .await;
    let url = Url::parse(&format!("http://audit.example:{}/page", address.port())).unwrap();
    let err = fetch_with_resolver(&url, "Test", options(200, 0), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap_err();
    assert!(!err.to_string().is_empty());
}

#[tokio::test]
async fn check_url_status_and_status_with_resolver_error_paths() {
    assert!(check_url_status("not a valid url", 1).await.is_err());
    assert!(check_url_status("http://127.0.0.1/", 1).await.is_err());
    assert!(check_url_status("ftp://audit.example/file", 1)
        .await
        .is_err());

    let no_host = Url::parse("file:///tmp/audit").unwrap();
    let err =
        check_status_with_resolver(&no_host, Duration::from_secs(1), |_| async { Ok(vec![]) })
            .await
            .unwrap_err();
    assert_eq!(err.to_string(), "URL has no host");

    let valid_url = Url::parse("http://audit.example/").unwrap();
    let err = check_status_with_resolver(&valid_url, Duration::from_secs(1), |_| async {
        Err(anyhow!("DNS lookup failed"))
    })
    .await
    .unwrap_err();
    assert!(err.to_string().contains("DNS lookup failed"));
}

#[tokio::test]
async fn fetch_page_rejects_private_url_before_network() {
    let url = Url::parse("http://127.0.0.1/").unwrap();
    let error = fetch_page_with_options(&url, "Test", 1, 100, false)
        .await
        .unwrap_err();
    assert!(error.to_string().contains("local/private IP"));
}
