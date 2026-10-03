use super::models::*;
use super::resolver::*;
use super::status::check_status_with_resolver;
use super::tests_common::*;
use chrono::Utc;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;
use url::Url;

#[tokio::test]
async fn test_fetch_result_model() {
    let result = FetchResult {
        url: "https://example.com".to_string(),
        final_url: "https://example.com/".to_string(),
        status: 200,
        response_time_ms: 120,
        headers: HashMap::from([("content-type".to_string(), "text/html".to_string())]),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: "<html><head><title>Test</title></head></html>".to_string(),
        http_performance: crate::models::audit_data::HttpPerformanceMeasurement {
            measured_at: Utc::now(),
            method: "GET".into(),
            response_headers_ms: 120,
            body_read_ms: 1,
            total_request_ms: 121,
            decoded_body_bytes: 42,
            content_length_header_bytes: None,
            redirect_hops: 0,
            scope: "native_http_get_includes_redirects_no_browser_render".into(),
        },
    };

    assert_eq!(result.status, 200);
    assert_eq!(
        result.headers.get("content-type"),
        Some(&"text/html".to_string())
    );
    assert!(result.body.contains("<title>Test</title>"));
}

#[test]
fn dns_rejects_empty_and_mixed_answers() {
    assert!(validate_addresses(vec![]).is_err());
    assert!(validate_addresses(vec![
        "93.184.216.34:80".parse().unwrap(),
        "127.0.0.1:80".parse().unwrap()
    ])
    .is_err());
    assert!(validate_addresses(vec!["[::1]:80".parse().unwrap()]).is_err());
    assert!(validate_addresses(vec!["93.184.216.34:80".parse().unwrap()]).is_ok());
}

#[tokio::test]
async fn literal_addresses_use_their_parsed_ip_and_preserve_ports() {
    for (target, expected) in [
        (
            "https://[2606:4700:4700::1111]/",
            "[2606:4700:4700::1111]:443",
        ),
        (
            "http://[2606:4700:4700::1111]:8080/",
            "[2606:4700:4700::1111]:8080",
        ),
        ("https://1.1.1.1/", "1.1.1.1:443"),
    ] {
        let url = Url::parse(target).unwrap();
        assert_eq!(
            resolve_public_addresses(&url).await.unwrap(),
            vec![expected.parse::<SocketAddr>().unwrap()]
        );
    }
}

#[tokio::test]
async fn literal_addresses_reject_private_and_special_ranges_before_transport() {
    for target in [
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://[fc00::1]/",
        "http://[::ffff:127.0.0.1]/",
    ] {
        let error = resolve_public_addresses(&Url::parse(target).unwrap())
            .await
            .unwrap_err();
        assert!(
            error.to_string().contains("private or reserved"),
            "{target}: {error}"
        );
    }
}

#[tokio::test]
async fn head_deadline_includes_dns_and_preserves_response_status() {
    let url = Url::parse("http://audit.example/").unwrap();
    let error = check_status_with_resolver(&url, Duration::from_millis(10), |_| async {
        tokio::time::sleep(Duration::from_secs(1)).await;
        Ok(vec!["1.1.1.1:80".parse().unwrap()])
    })
    .await
    .unwrap_err();
    assert!(error.to_string().contains("timed out"));
    let address = fixture(vec![
        "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
    ])
    .await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    assert_eq!(
        check_status_with_resolver(&url, Duration::from_secs(1), |_| async {
            Ok(vec![address])
        })
        .await
        .unwrap()
        .0,
        404
    );
}
