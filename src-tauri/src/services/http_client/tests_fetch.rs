use super::entry::*;
use super::fetch::*;
use super::resolver::validate_addresses;
use super::status::check_url_status;
use super::tests_common::{fixture, options};
use std::time::Duration;
use url::Url;

#[tokio::test]
async fn rejects_initial_dns_before_transport() {
    let url = Url::parse("http://audit.example/").unwrap();
    let result = fetch_with_resolver(&url, "Test", options(16, 2), |_| async {
        validate_addresses(vec!["127.0.0.1:80".parse().unwrap()])
    })
    .await;
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("private or reserved"));
}

#[tokio::test]
async fn pinned_transport_preserves_headers_cookies_and_measurements() {
    let address = fixture(vec!["HTTP/1.1 200 OK\r\nContent-Length: 5\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\nConnection: close\r\n\r\nhello".into()]).await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let result = fetch_with_resolver(&url, "Test", options(5, 0), |_| async { Ok(vec![address]) })
        .await
        .unwrap();
    assert_eq!(result.body, "hello");
    assert_eq!(result.set_cookie_headers, ["a=1", "b=2"]);
    assert_eq!(result.http_performance.decoded_body_bytes, 5);
    assert_eq!(result.http_performance.content_length_header_bytes, Some(5));
    assert!(result.http_performance.total_request_ms >= result.response_time_ms);
}

#[tokio::test]
async fn rejects_redirect_dns_before_connection() {
    let address = fixture(vec!["HTTP/1.1 302 Found\r\nLocation: http://private.example/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into()]).await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let result = fetch_with_resolver(&url, "Test", options(16, 2), |url| async move {
        if url.host_str() == Some("private.example") {
            validate_addresses(vec!["10.0.0.1:80".parse().unwrap()])
        } else {
            Ok(vec![address])
        }
    })
    .await;
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("private or reserved"));
}

#[tokio::test]
async fn follows_relative_redirect_and_records_hop() {
    let address = fixture(vec![
        "HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            .into(),
        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok".into(),
    ])
    .await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let result = fetch_with_resolver(&url, "Test", options(16, 1), |_| async {
        Ok(vec![address])
    })
    .await
    .unwrap();
    assert!(result.final_url.ends_with("/next"));
    assert_eq!(result.redirect_chain.len(), 1);
    assert_eq!(result.redirect_chain[0].status_code, 302);
    assert_eq!(result.redirect_chain[0].url, url.to_string());
    assert_eq!(result.http_performance.redirect_hops, 1);
}

#[tokio::test]
async fn rejects_unsafe_redirects_and_zero_redirect_budget() {
    for (location, budget, expected) in [
        ("http://127.0.0.1/", 1, "Unsafe redirect"),
        ("http://user:secret@audit.example/", 1, "Unsafe redirect"),
        ("file:///etc/passwd", 1, "Unsafe redirect"),
        ("/next", 0, "Too many redirects"),
    ] {
        let address = fixture(vec![format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")]).await;
        let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
        let error = fetch_with_resolver(&url, "Test", options(16, budget), |_| async {
            Ok(vec![address])
        })
        .await
        .unwrap_err();
        assert!(error.to_string().contains(expected), "{error}");
    }
}

#[tokio::test]
async fn deadline_includes_dns_resolution() {
    let url = Url::parse("http://audit.example/").unwrap();
    let error = fetch_with_resolver(&url, "Test", options(5, 0), |_| async {
        tokio::time::sleep(Duration::from_secs(1)).await;
        Ok(vec!["93.184.216.34:80".parse().unwrap()])
    })
    .await
    .unwrap_err();
    assert!(error.to_string().contains("timed out"));
}

#[tokio::test]
async fn public_entry_points_reject_unsafe_urls() {
    let url = Url::parse("http://127.0.0.1/").unwrap();
    assert!(fetch_page(&url, "Test", 1).await.is_err());
    assert!(fetch_page_with_options(&url, "Test", 1, 0, true)
        .await
        .is_err());
    assert!(check_url_status(url.as_str(), 1).await.is_err());
}
