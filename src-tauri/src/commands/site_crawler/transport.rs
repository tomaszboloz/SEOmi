use super::*;

pub(super) fn redirect_target_is_new(seen: &mut HashSet<String>, target: &str) -> bool {
    seen.insert(target.to_string())
}

pub(crate) fn crawl_deadline_reached(start_time: Instant, max_run_seconds: Option<u64>) -> bool {
    max_run_seconds
        .is_some_and(|seconds| start_time.elapsed() >= std::time::Duration::from_secs(seconds))
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn request_with_safe_redirects(
    client: &reqwest::Client,
    initial_url: &str,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
) -> Result<FetchedResponse, reqwest::Error> {
    let mut requested_url = initial_url.to_string();
    let mut chain = Vec::new();
    let mut seen_targets = HashSet::from([requested_url.clone()]);
    loop {
        let request_started_at = Instant::now();
        let response = client.get(&requested_url).send().await?;
        let response_time_ms = request_started_at.elapsed().as_millis() as u64;
        let status = response.status().as_u16();
        if !(300..400).contains(&status) {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: None,
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
                })
            }
        };
        let validated = match validate_and_normalize_url(next.as_str()) {
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
                })
            }
            Err(error) => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some(format!("Redirect target was rejected: {error}")),
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
            });
        }
        requested_url = normalized.to_string();
    }
}
