use crate::models::audit_data::{HttpPerformanceMeasurement, RedirectHop};
use anyhow::{anyhow, Result};
use chrono::Utc;
use reqwest::header::{HeaderValue, USER_AGENT};
use reqwest::redirect::Policy;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::net::lookup_host;
use tokio::time::timeout;
use url::Url;

use crate::utils::url_validator::{is_public_ip, validate_and_normalize_url};

const MAX_BODY_BYTES: usize = 25 * 1024 * 1024; // 25 MB max to prevent memory exhaustion
const DNS_TIMEOUT: Duration = Duration::from_secs(5);

async fn resolve_public_addresses(url: &Url) -> Result<Vec<SocketAddr>> {
    let host = url.host_str().ok_or_else(|| anyhow!("URL has no host"))?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow!("URL has no HTTP port"))?;
    let addresses = timeout(DNS_TIMEOUT, lookup_host((host, port)))
        .await
        .map_err(|_| anyhow!("DNS lookup timed out"))?
        .map_err(|error| anyhow!("DNS lookup failed: {error}"))?
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        return Err(anyhow!("DNS returned no addresses"));
    }
    if addresses.iter().any(|address| !is_public_ip(&address.ip())) {
        return Err(anyhow!(
            "DNS resolved to a private or reserved address; request blocked"
        ));
    }
    Ok(addresses)
}

#[derive(Debug, Clone)]
pub struct FetchResult {
    pub url: String,
    pub final_url: String,
    pub status: u16,
    pub response_time_ms: u64,
    pub headers: HashMap<String, String>,
    pub set_cookie_headers: Vec<String>,
    pub redirect_chain: Vec<RedirectHop>,
    pub body: String,
    pub http_performance: HttpPerformanceMeasurement,
}

/// Custom redirect tracker to record each intermediate status code and location header
pub async fn fetch_page(
    target_url: &Url,
    user_agent_str: &str,
    timeout_secs: u64,
) -> Result<FetchResult> {
    fetch_page_with_options(target_url, user_agent_str, timeout_secs, 10, true).await
}

pub async fn fetch_page_with_options(
    target_url: &Url,
    user_agent_str: &str,
    timeout_secs: u64,
    max_redirects: usize,
    verify_ssl: bool,
) -> Result<FetchResult> {
    let max_redirects = max_redirects.min(20);
    let hops: Arc<Mutex<Vec<RedirectHop>>> = Arc::new(Mutex::new(Vec::new()));
    let hops_clone = Arc::clone(&hops);
    let redirect_counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = Arc::clone(&redirect_counter);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .danger_accept_invalid_certs(!verify_ssl)
        .redirect(Policy::custom(move |attempt| {
            // Redirects are untrusted input. Validate every hop instead of
            // assuming that a public start URL cannot bounce to localhost,
            // a private IP, or a URL carrying embedded credentials.
            if let Err(error) = validate_and_normalize_url(attempt.url().as_str()) {
                return attempt.error(anyhow!("Unsafe redirect blocked: {error}"));
            }
            let count = counter_clone.fetch_add(1, Ordering::SeqCst);
            if count >= max_redirects {
                return attempt.error(anyhow!("Too many redirects (max {max_redirects} allowed)"));
            }

            let previous = attempt.previous();
            if let Some(prev_url) = previous.last() {
                let status = attempt.status();
                let loc = attempt.url().as_str().to_string();

                if let Ok(mut list) = hops_clone.lock() {
                    list.push(RedirectHop {
                        url: prev_url.to_string(),
                        status_code: status.as_u16(),
                        location: Some(loc),
                    });
                }
            }

            attempt.follow()
        }))
        .gzip(true)
        .brotli(true)
        .build()?;

    let mut request_builder = client.get(target_url.as_str());
    if let Ok(ua_val) = HeaderValue::from_str(user_agent_str) {
        request_builder = request_builder.header(USER_AGENT, ua_val);
    }

    let measured_at = Utc::now();
    let start_time = Instant::now();
    let response = request_builder.send().await?;
    let response_headers_ms = start_time.elapsed().as_millis() as u64;

    let final_url = response.url().to_string();
    let status = response.status().as_u16();

    // Collect headers into lowercase map
    let mut headers_map = HashMap::new();
    for (name, val) in response.headers().iter() {
        if let Ok(str_val) = val.to_str() {
            headers_map.insert(name.as_str().to_lowercase(), str_val.to_string());
        }
    }
    let set_cookie_headers = response
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok().map(str::to_string))
        .collect();

    // Read body safely with length limit
    let body_start = Instant::now();
    let bytes = response.bytes().await?;
    let body_read_ms = body_start.elapsed().as_millis() as u64;
    let decoded_body_bytes = bytes.len() as u64;
    if bytes.len() > MAX_BODY_BYTES {
        return Err(anyhow!(
            "Response size exceeds safety limit of 25MB (received {} bytes)",
            bytes.len()
        ));
    }

    let body = String::from_utf8_lossy(&bytes).to_string();
    let recorded_hops = hops.lock().map(|h| h.clone()).unwrap_or_default();
    let redirect_hops = recorded_hops.len();
    let total_request_ms = start_time.elapsed().as_millis() as u64;
    let content_length_header_bytes = headers_map
        .get("content-length")
        .and_then(|value| value.parse::<u64>().ok());

    Ok(FetchResult {
        url: target_url.to_string(),
        final_url,
        status,
        response_time_ms: response_headers_ms,
        headers: headers_map,
        set_cookie_headers,
        redirect_chain: recorded_hops,
        body,
        http_performance: HttpPerformanceMeasurement {
            measured_at,
            method: "GET".into(),
            response_headers_ms,
            body_read_ms,
            total_request_ms,
            decoded_body_bytes,
            content_length_header_bytes,
            redirect_hops,
            scope: "native_http_get_includes_redirects_no_browser_render".into(),
        },
    })
}

/// Helper to check HTTP status of an external or internal link
pub async fn check_url_status(url_str: &str, timeout_secs: u64) -> Result<(u16, u64)> {
    let url = validate_and_normalize_url(url_str).map_err(|error| anyhow!(error.to_string()))?;
    let host = url.host_str().ok_or_else(|| anyhow!("URL has no host"))?;
    let addresses = resolve_public_addresses(&url).await?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_secs(timeout_secs))
        .redirect(Policy::none())
        .no_proxy()
        .resolve_to_addrs(host, &addresses)
        .build()?;

    let start = Instant::now();
    let resp = client.head(url).send().await?;
    let time = start.elapsed().as_millis() as u64;
    Ok((resp.status().as_u16(), time))
}

#[cfg(test)]
mod tests {
    use super::*;

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
            http_performance: HttpPerformanceMeasurement {
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

    #[tokio::test]
    async fn test_fetch_page_live_redirect() {
        let url = Url::parse("http://rust-lang.org").unwrap();
        let res = fetch_page(&url, "SEOmi-TestBot", 10).await;
        if let Ok(result) = res {
            assert_eq!(result.status, 200);
            assert!(result.body.contains("Rust"));
            assert!(!result.redirect_chain.is_empty());
            assert_eq!(result.final_url, "https://rust-lang.org/");
        }
    }
}
