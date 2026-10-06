use super::transport::{analyze_fetch_result, fetch_and_analyze, fetch_and_analyze_with_resolver};
use crate::models::audit_data::HttpPerformanceMeasurement;
use crate::services::http_client::FetchResult;
use anyhow::anyhow;
use chrono::Utc;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
use url::Url;

const HTML: &str = "<!doctype html><html><head><title>Fixture SEO page</title><meta name=\"description\" content=\"A stable local fixture page for the SEO audit transport contract.\"><link rel=\"canonical\" href=\"/\"></head><body><main><h1>Fixture</h1><p>Content for the local audit.</p></main></body></html>";

async fn fixture(status: &str, body: &str) -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let location = if status.starts_with("302") {
        "Location: /next\r\n"
    } else {
        ""
    };
    let response = format!(
        "HTTP/1.1 {status}\r\n{location}Content-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = [0; 4096];
        let _ = socket.read(&mut request).await;
        socket.write_all(response.as_bytes()).await.unwrap();
    });
    address
}

fn performance() -> HttpPerformanceMeasurement {
    HttpPerformanceMeasurement {
        measured_at: Utc::now(),
        method: "GET".into(),
        response_headers_ms: 0,
        body_read_ms: 0,
        total_request_ms: 0,
        decoded_body_bytes: 0,
        content_length_header_bytes: None,
        redirect_hops: 0,
        scope: "fixture".into(),
    }
}

#[tokio::test]
async fn transport_seam_runs_real_http_and_seo_analysis_for_default_options() {
    let address = fixture("200 OK", HTML).await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let report = fetch_and_analyze_with_resolver(
        &url,
        "FixtureBot",
        Duration::from_secs(1),
        10,
        true,
        move |_| async move { Ok(vec![address]) },
    )
    .await
    .unwrap();
    assert_eq!(report.http_status, 200);
    assert_eq!(report.meta_tags.title.as_deref(), Some("Fixture SEO page"));
    assert_eq!(report.headings.h1_count, 1);
    assert_eq!(report.http_performance.unwrap().method, "GET");
}

#[tokio::test]
async fn public_transport_path_keeps_private_targets_blocked() {
    let url = Url::parse("http://127.0.0.1/private").unwrap();
    let error = fetch_and_analyze(&url, "FixtureBot", 1, 10, true)
        .await
        .unwrap_err();
    assert!(error.to_string().contains("local/private IP"));
}

#[tokio::test]
async fn transport_seam_preserves_custom_redirect_options_and_maps_network_errors() {
    let address = fixture("302 Found", "").await;
    let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
    let error = fetch_and_analyze_with_resolver(
        &url,
        "FixtureBot",
        Duration::from_secs(1),
        0,
        false,
        move |_| async move { Ok(vec![address]) },
    )
    .await
    .unwrap_err();
    assert!(error.to_string().contains("Too many redirects"));
    let error = fetch_and_analyze_with_resolver(
        &url,
        "FixtureBot",
        Duration::from_secs(1),
        10,
        true,
        |_| async { Err(anyhow!("resolver unavailable")) },
    )
    .await
    .unwrap_err();
    assert!(error
        .to_string()
        .contains("Network request failed: resolver unavailable"));
}

#[tokio::test]
async fn transport_seam_maps_timeout_and_analyzer_results() {
    let url = Url::parse("http://audit.example/").unwrap();
    let error = fetch_and_analyze_with_resolver(
        &url,
        "FixtureBot",
        Duration::from_millis(1),
        10,
        true,
        |_| async {
            tokio::time::sleep(Duration::from_millis(25)).await;
            Ok(vec!["93.184.216.34:80".parse().unwrap()])
        },
    )
    .await
    .unwrap_err();
    assert!(error.to_string().contains("HTTP operation timed out"));
    let invalid = FetchResult {
        url: "invalid".into(),
        final_url: "invalid".into(),
        status: 200,
        response_time_ms: 0,
        headers: HashMap::new(),
        set_cookie_headers: Vec::new(),
        redirect_chain: Vec::new(),
        body: String::new(),
        http_performance: performance(),
    };
    let error = analyze_fetch_result(Ok(invalid)).await.unwrap_err();
    assert!(error
        .to_string()
        .contains("SEO analysis failed: Audit response has no valid absolute URL"));
}
