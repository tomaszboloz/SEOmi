use super::super::retry::{send_get_with_retry, RetryContext, RetryError};
use super::super::{
    fetch_types::{FetchedPageBody, FetchedResponse},
    models::{CrawlConfig, CrawledRedirectHop},
    scope::matches_scope,
    transport::redirect_target_is_new,
    url_normalization::normalize_crawl_url,
};
use std::{collections::HashSet, time::Instant};

#[allow(clippy::too_many_arguments)]
pub(crate) async fn request_with_safe_redirects_with_context(
    client: &reqwest::Client,
    initial_url: &str,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
    context: RetryContext,
) -> Result<FetchedResponse, RetryError> {
    let mut requested_url = initial_url.to_string();
    let mut chain = Vec::new();
    let mut seen_targets = HashSet::from([requested_url.clone()]);
    let mut retry_available = true;
    let mut retry_count = 0;
    loop {
        let request_started_at = Instant::now();
        let fetched =
            send_get_with_retry(client, &requested_url, &context, &mut retry_available).await?;
        retry_count += fetched.retries;
        let response = fetched.response;
        let response_time_ms = request_started_at.elapsed().as_millis() as u64;
        let status = response.status().as_u16();
        if !matches!(status, 301 | 302 | 303 | 307 | 308) {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: None,
                request_duration_ms: Some(response_time_ms),
                retry_count,
            });
        }
        let Some(location) = response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
        else {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: Some(
                    "Redirect response has no valid Location header".into(),
                ),
                request_duration_ms: Some(response_time_ms),
                retry_count,
            });
        };
        let next = match url::Url::parse(&requested_url)
            .ok()
            .and_then(|base| base.join(location).ok())
        {
            Some(url) => url,
            None => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some("Redirect Location cannot be resolved".into()),
                    request_duration_ms: Some(response_time_ms),
                    retry_count,
                })
            }
        };
        let validated = match super::super::validate_and_normalize_url(next.as_str()) {
            Ok(url)
                if matches_scope(&url, base_host, allow_subdomains, scope_path, allowed_hosts) =>
            {
                url
            }
            Ok(_) => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some(
                        "Redirect target is outside the configured crawl scope".into(),
                    ),
                    request_duration_ms: Some(response_time_ms),
                    retry_count,
                })
            }
            Err(error) => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some(format!("Redirect target was rejected: {error}")),
                    request_duration_ms: Some(response_time_ms),
                    retry_count,
                })
            }
        };
        let normalized = normalize_crawl_url(validated, config);
        chain.push(CrawledRedirectHop {
            from_url: requested_url.clone(),
            http_status: status,
            to_url: normalized.to_string(),
            response_time_ms: Some(response_time_ms),
        });
        if !redirect_target_is_new(&mut seen_targets, normalized.as_str()) {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: Some(
                    "Redirect loop detected; the repeated target was not requested again".into(),
                ),
                request_duration_ms: Some(response_time_ms),
                retry_count,
            });
        }
        if chain.len() > max_redirects {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: Some(format!(
                    "Redirect limit of {max_redirects} exceeded"
                )),
                request_duration_ms: Some(response_time_ms),
                retry_count,
            });
        }
        requested_url = normalized.to_string();
    }
}
