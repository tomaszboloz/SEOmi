use crate::models::audit_data::{HttpPerformanceMeasurement, RedirectHop};
use anyhow::{anyhow, Result};
use chrono::Utc;
use reqwest::header::{HeaderValue, USER_AGENT};
use reqwest::redirect::Policy;
use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::lookup_host;
use tokio::time::timeout;
use url::{Host, Url};

use crate::utils::url_validator::{is_public_ip, validate_and_normalize_url};

const MAX_BODY_BYTES: usize = 25 * 1024 * 1024; // 25 MB max to prevent memory exhaustion
const DNS_TIMEOUT: Duration = Duration::from_secs(5);

struct ValidatedResolver<R> {
    lookup: R,
}

impl<R, F> reqwest::dns::Resolve for ValidatedResolver<R>
where
    R: Fn(String) -> F + Send + Sync,
    F: Future<Output = std::io::Result<Vec<SocketAddr>>> + Send + 'static,
{
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let lookup = (self.lookup)(name.as_str().to_owned());
        Box::pin(async move {
            let addresses = timeout(DNS_TIMEOUT, lookup).await.map_err(|_| {
                std::io::Error::new(std::io::ErrorKind::TimedOut, "DNS lookup timed out")
            })??;
            let addresses = validate_addresses(addresses).map_err(|error| {
                std::io::Error::new(std::io::ErrorKind::PermissionDenied, error.to_string())
            })?;
            Ok(Box::new(addresses.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

fn public_client_builder_with_lookup<R, F>(lookup: R) -> reqwest::ClientBuilder
where
    R: Fn(String) -> F + Send + Sync + 'static,
    F: Future<Output = std::io::Result<Vec<SocketAddr>>> + Send + 'static,
{
    reqwest::Client::builder()
        .no_proxy()
        .redirect(Policy::none())
        .dns_resolver(Arc::new(ValidatedResolver { lookup }))
}

/// URLs must first pass validate_and_normalize_url, which checks literal IPs.
/// DNS names are resolved only once per connection and every answer is checked.
/// Ambient proxies are disabled; an explicit user proxy is an opt-in boundary.
pub fn public_client_builder() -> reqwest::ClientBuilder {
    public_client_builder_with_lookup(|host| async move {
        Ok(lookup_host((host.as_str(), 0)).await?.collect())
    })
}

async fn read_bounded_bytes(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>> {
    let limit = limit.min(MAX_BODY_BYTES);
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(anyhow!(
                "Response size exceeds safety limit of {limit} bytes"
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

pub async fn read_bounded_text(response: reqwest::Response, limit: usize) -> Result<String> {
    let bytes = read_bounded_bytes(response, limit).await?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

async fn resolve_public_addresses(url: &Url) -> Result<Vec<SocketAddr>> {
    let host = url.host().ok_or_else(|| anyhow!("URL has no host"))?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| anyhow!("URL has no HTTP port"))?;
    let domain = match host {
        Host::Ipv4(ip) => return validate_addresses(vec![SocketAddr::new(IpAddr::V4(ip), port)]),
        Host::Ipv6(ip) => return validate_addresses(vec![SocketAddr::new(IpAddr::V6(ip), port)]),
        Host::Domain(domain) => domain,
    };
    let addresses = timeout(DNS_TIMEOUT, lookup_host((domain, port)))
        .await
        .map_err(|_| anyhow!("DNS lookup timed out"))?
        .map_err(|error| anyhow!("DNS lookup failed: {error}"))?
        .collect::<Vec<_>>();
    validate_addresses(addresses)
}

fn validate_addresses(addresses: Vec<SocketAddr>) -> Result<Vec<SocketAddr>> {
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
    fetch_with_resolver(
        target_url,
        user_agent_str,
        FetchOptions {
            timeout: Duration::from_secs(timeout_secs),
            max_redirects: max_redirects.min(20),
            verify_ssl,
            max_body_bytes: MAX_BODY_BYTES,
        },
        |url| async move { resolve_public_addresses(&url).await },
    )
    .await
}

struct FetchOptions {
    timeout: Duration,
    max_redirects: usize,
    verify_ssl: bool,
    max_body_bytes: usize,
}

// The resolver contract returns addresses approved for this request. Production
// rejects every non-public answer; only local fixtures supply loopback addresses.
// A fresh pinned client per hop prevents DNS rebinding and cross-host reuse.
async fn fetch_with_resolver<R, F>(
    target_url: &Url,
    user_agent_str: &str,
    options: FetchOptions,
    resolve: R,
) -> Result<FetchResult>
where
    R: Fn(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>>>,
{
    timeout(options.timeout, async {
        let mut current = validate_and_normalize_url(target_url.as_str())
            .map_err(|error| anyhow!(error.to_string()))?;
        let measured_at = Utc::now();
        let start_time = Instant::now();
        let mut recorded_hops = Vec::new();
        let response = loop {
            let addresses = resolve(current.clone()).await?;
            let host = current
                .host_str()
                .ok_or_else(|| anyhow!("URL has no host"))?;
            let client = reqwest::Client::builder()
                .danger_accept_invalid_certs(!options.verify_ssl)
                .redirect(Policy::none())
                .no_proxy()
                .resolve_to_addrs(host, &addresses)
                .gzip(true)
                .brotli(true)
                .build()?;
            let mut request = client.get(current.clone());
            if let Ok(value) = HeaderValue::from_str(user_agent_str) {
                request = request.header(USER_AGENT, value);
            }
            let response = request.send().await?;
            if matches!(response.status().as_u16(), 301 | 302 | 303 | 307 | 308) {
                if let Some(location) = response.headers().get(reqwest::header::LOCATION) {
                    let next = current.join(location.to_str()?)?;
                    let next = validate_and_normalize_url(next.as_str())
                        .map_err(|error| anyhow!("Unsafe redirect blocked: {error}"))?;
                    if recorded_hops.len() >= options.max_redirects {
                        return Err(anyhow!(
                            "Too many redirects (max {} allowed)",
                            options.max_redirects
                        ));
                    }
                    recorded_hops.push(RedirectHop {
                        url: current.to_string(),
                        status_code: response.status().as_u16(),
                        location: Some(next.to_string()),
                    });
                    current = next;
                    continue;
                }
            }
            break response;
        };
        let response_headers_ms = start_time.elapsed().as_millis() as u64;
        let final_url = response.url().to_string();
        let status = response.status().as_u16();
        let headers_map: HashMap<String, String> = response
            .headers()
            .iter()
            .filter_map(|(name, value)| {
                value
                    .to_str()
                    .ok()
                    .map(|value| (name.as_str().to_lowercase(), value.to_owned()))
            })
            .collect();
        let set_cookie_headers = response
            .headers()
            .get_all(reqwest::header::SET_COOKIE)
            .iter()
            .filter_map(|value| value.to_str().ok().map(str::to_string))
            .collect();
        let body_start = Instant::now();
        let bytes = read_bounded_bytes(response, options.max_body_bytes).await?;
        let body_read_ms = body_start.elapsed().as_millis() as u64;
        let decoded_body_bytes = bytes.len() as u64;
        let body = String::from_utf8_lossy(&bytes).to_string();
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
    })
    .await
    .map_err(|_| anyhow!("HTTP operation timed out"))?
}

/// Helper to check HTTP status of an external or internal link
pub async fn check_url_status(url_str: &str, timeout_secs: u64) -> Result<(u16, u64)> {
    let url = validate_and_normalize_url(url_str).map_err(|error| anyhow!(error.to_string()))?;
    check_status_with_resolver(&url, Duration::from_secs(timeout_secs), |url| async move {
        resolve_public_addresses(&url).await
    })
    .await
}

async fn check_status_with_resolver<R, F>(
    url: &Url,
    budget: Duration,
    resolve: R,
) -> Result<(u16, u64)>
where
    R: Fn(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>>>,
{
    timeout(budget, async {
        let host = url.host_str().ok_or_else(|| anyhow!("URL has no host"))?;
        let addresses = resolve(url.clone()).await?;
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .no_proxy()
            .resolve_to_addrs(host, &addresses)
            .build()?;
        let start = Instant::now();
        let response = client.head(url.clone()).send().await?;
        Ok((
            response.status().as_u16(),
            start.elapsed().as_millis() as u64,
        ))
    })
    .await
    .map_err(|_| anyhow!("HTTP operation timed out"))?
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

    fn options(limit: usize, redirects: usize) -> FetchOptions {
        FetchOptions {
            timeout: Duration::from_millis(250),
            max_redirects: redirects,
            verify_ssl: true,
            max_body_bytes: limit,
        }
    }

    async fn fixture(responses: Vec<String>) -> SocketAddr {
        fixture_bytes(responses.into_iter().map(String::into_bytes).collect()).await
    }

    async fn fixture_bytes(responses: Vec<Vec<u8>>) -> SocketAddr {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            for response in responses {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut request = vec![0; 4096];
                let _ = stream.read(&mut request).await;
                let _ = stream.write_all(&response).await;
            }
        });
        address
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

    #[tokio::test]
    async fn shared_client_blocks_private_dns_before_opening_a_socket() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let client = public_client_builder_with_lookup(move |host| async move {
            assert_eq!(host, "crawl.example");
            Ok(vec![address])
        })
        .build()
        .unwrap();
        let error = client
            .get("http://crawl.example/")
            .send()
            .await
            .unwrap_err();
        assert!(format!("{error:?}").contains("private or reserved"));
        assert!(timeout(Duration::from_millis(20), listener.accept())
            .await
            .is_err());
    }

    #[tokio::test]
    async fn shared_resolver_checks_every_address_and_does_not_fabricate_dns_success() {
        use reqwest::dns::Resolve;
        for addresses in [
            vec![],
            vec!["1.1.1.1:0".parse().unwrap(), "127.0.0.1:0".parse().unwrap()],
        ] {
            let resolver = ValidatedResolver {
                lookup: move |_host| {
                    let addresses = addresses.clone();
                    async move { Ok(addresses) }
                },
            };
            assert!(resolver
                .resolve("crawl.example".parse().unwrap())
                .await
                .is_err());
        }
        let resolver = ValidatedResolver {
            lookup: |_host| async {
                Ok(vec![
                    "1.1.1.1:0".parse().unwrap(),
                    "[2606:4700:4700::1111]:0".parse().unwrap(),
                ])
            },
        };
        assert_eq!(
            resolver
                .resolve("crawl.example".parse().unwrap())
                .await
                .unwrap()
                .count(),
            2
        );
        let resolver = ValidatedResolver {
            lookup: |_host| async {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "DNS failed",
                ))
            },
        };
        assert!(resolver
            .resolve("crawl.example".parse().unwrap())
            .await
            .is_err());
    }

    #[tokio::test]
    async fn discovery_text_rejects_decoded_overflow_and_keeps_exact_limit() {
        for (response, limit, expected) in [
            ("HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nhello", 5, Some("hello")),
            ("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\n1234\r\n4\r\n5678\r\n0\r\n\r\n", 5, None),
            ("HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\nx", 0, None),
        ] {
            let address = fixture(vec![response.into()]).await;
            let response = reqwest::Client::builder().no_proxy().build().unwrap()
                .get(format!("http://{address}/")).send().await.unwrap();
            let result = read_bounded_text(response, limit).await;
            if let Some(expected) = expected { assert_eq!(result.unwrap(), expected); }
            else { assert!(result.unwrap_err().to_string().contains("safety limit")); }
        }
    }

    #[tokio::test]
    async fn public_client_uses_validated_local_dns_without_contacting_local_services() {
        let error = public_client_builder()
            .build()
            .unwrap()
            .get("http://localhost/")
            .send()
            .await
            .unwrap_err();
        assert!(format!("{error:?}").contains("private or reserved"));
    }

    #[tokio::test]
    async fn discovery_text_rejects_compressed_overflow_and_incomplete_bodies() {
        use std::io::Write;
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&[b'x'; 128]).unwrap();
        let compressed = encoder.finish().unwrap();
        let mut encoded_response = format!("HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", compressed.len()).into_bytes();
        encoded_response.extend(compressed);
        let address = fixture_bytes(vec![encoded_response]).await;
        let response = reqwest::Client::builder()
            .no_proxy()
            .gzip(true)
            .build()
            .unwrap()
            .get(format!("http://{address}/"))
            .send()
            .await
            .unwrap();
        assert!(read_bounded_text(response, 64)
            .await
            .unwrap_err()
            .to_string()
            .contains("safety limit"));

        let address = fixture(vec![
            "HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\nshort".into(),
        ])
        .await;
        let response = reqwest::Client::builder()
            .no_proxy()
            .build()
            .unwrap()
            .get(format!("http://{address}/"))
            .send()
            .await
            .unwrap();
        assert!(read_bounded_text(response, 64).await.is_err());
    }

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
        let result =
            fetch_with_resolver(&url, "Test", options(5, 0), |_| async { Ok(vec![address]) })
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
            "HTTP/1.1 302 Found\r\nLocation: /next\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".into(),
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok".into()]).await;
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
    async fn streaming_limit_applies_without_content_length() {
        let address = fixture(vec!["HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n4\r\n1234\r\n4\r\n5678\r\n0\r\n\r\n".into()]).await;
        let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
        let error =
            fetch_with_resolver(&url, "Test", options(5, 0), |_| async { Ok(vec![address]) })
                .await
                .unwrap_err();
        assert!(error.to_string().contains("safety limit"));
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

    #[tokio::test]
    async fn compressed_body_limit_counts_decoded_bytes() {
        use std::io::Write;
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&[b'x'; 128]).unwrap();
        let compressed = encoder.finish().unwrap();
        let mut response = format!("HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", compressed.len()).into_bytes();
        response.extend(compressed);
        let address = fixture_bytes(vec![response]).await;
        let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
        let error = fetch_with_resolver(&url, "Test", options(64, 0), |_| async {
            Ok(vec![address])
        })
        .await
        .unwrap_err();
        assert!(error.to_string().contains("safety limit"));
    }

    #[tokio::test]
    async fn deadline_applies_to_slow_body() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buffer = [0; 4096];
            let _ = stream.read(&mut buffer).await;
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nh")
                .await
                .unwrap();
            tokio::time::sleep(Duration::from_secs(1)).await;
        });
        let url = Url::parse(&format!("http://audit.example:{}/", address.port())).unwrap();
        let error =
            fetch_with_resolver(&url, "Test", options(5, 0), |_| async { Ok(vec![address]) })
                .await
                .unwrap_err();
        assert!(error.to_string().contains("timed out"), "{error}");
    }
}
