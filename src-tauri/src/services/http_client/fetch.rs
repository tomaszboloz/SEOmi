use super::models::{FetchOptions, FetchResult};
use super::stream::read_bounded_bytes;
use crate::models::audit_data::{HttpPerformanceMeasurement, RedirectHop};
use crate::utils::url_validator::validate_and_normalize_url;
use anyhow::{anyhow, Result};
use chrono::Utc;
use reqwest::header::{HeaderValue, USER_AGENT};
use reqwest::redirect::Policy;
use std::collections::HashMap;
use std::future::Future;
use std::net::SocketAddr;
use std::time::Instant;
use url::Url;

// The resolver contract returns addresses approved for this request. Production
// rejects every non-public answer; only local fixtures supply loopback addresses.
// A fresh pinned client per hop prevents DNS rebinding and cross-host reuse.
pub async fn fetch_with_resolver<R, F>(
    target_url: &Url,
    user_agent_str: &str,
    options: FetchOptions,
    resolve: R,
) -> Result<FetchResult>
where
    R: Fn(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>>>,
{
    tokio::time::timeout(options.timeout, async {
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
