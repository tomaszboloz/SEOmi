use super::*;

pub(super) fn redirect_target_is_new(seen: &mut HashSet<String>, target: &str) -> bool {
    seen.insert(target.to_string())
}

pub(super) fn classify_request_error(
    is_timeout: bool,
    is_connect: bool,
    detail: &str,
) -> &'static str {
    let detail = detail.to_ascii_lowercase();
    if is_timeout
        || detail.contains("timed out")
        || detail.contains("timeout")
        || detail.contains("deadline has elapsed")
    {
        return "timeout";
    }
    // DNS and TLS failures are often wrapped by reqwest as a generic connect
    // error. Inspect the full source-chain text before falling back to the
    // broad connect bucket so the UI and CSV retain the useful root cause.
    if detail.contains("dns")
        || detail.contains("name or service not known")
        || detail.contains("temporary failure in name resolution")
        || detail.contains("failed to lookup address")
        || detail.contains("could not resolve host")
        || detail.contains("nodename nor servname")
        || detail.contains("no such host")
    {
        return "dns";
    }
    if detail.contains("tls")
        || detail.contains("certificate")
        || detail.contains("unknown ca")
        || detail.contains("invalid peer certificate")
        || detail.contains("handshake failure")
        || detail.contains("rustls")
        || detail.contains("native-tls")
    {
        return "tls";
    }
    if is_connect
        || detail.contains("connection refused")
        || detail.contains("connection reset")
        || detail.contains("connection aborted")
        || detail.contains("failed to connect")
        || detail.contains("connect error")
        || detail.contains("network is unreachable")
    {
        return "connect";
    }
    "network"
}

pub(super) fn request_error_kind(error: &reqwest::Error) -> String {
    let mut detail = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        detail.push_str(" | ");
        detail.push_str(&cause.to_string());
        source = cause.source();
    }
    classify_request_error(error.is_timeout(), error.is_connect(), &detail).into()
}

pub(super) fn crawl_deadline_reached(start_time: Instant, max_run_seconds: Option<u64>) -> bool {
    max_run_seconds
        .is_some_and(|seconds| start_time.elapsed() >= std::time::Duration::from_secs(seconds))
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn request_with_safe_redirects(
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

/// Fetch a bounded window of HTML pages concurrently while keeping parsing and
/// queue expansion deterministic. Resource requests already use this pattern;
/// the same window is safe for HTML only when robots crawl-delay is absent.
#[allow(clippy::too_many_arguments)]
pub(super) async fn prefetch_http_pages(
    queue: &mut VecDeque<(String, usize)>,
    prefetched_order: &mut VecDeque<(String, usize)>,
    prefetched_responses: &mut HashMap<String, Result<FetchedResponse, CrawlFetchFailure>>,
    max_concurrent_requests: usize,
    max_pages: usize,
    completed_pages: usize,
    client: &reqwest::Client,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
    robots_rules: &[RobotsRule],
) {
    let slots = max_concurrent_requests
        .min(max_pages.saturating_sub(completed_pages + prefetched_order.len()));
    if slots < 2 || queue.is_empty() {
        return;
    }

    let mut candidates = Vec::with_capacity(slots);
    for _ in 0..slots {
        let Some((url, depth)) = queue.pop_front() else {
            break;
        };
        prefetched_order.push_back((url.clone(), depth));
        if config.respect_robots
            && url::Url::parse(&url)
                .ok()
                .is_some_and(|parsed| !robots_allows(&parsed, robots_rules))
        {
            // Leave disallowed pages in the ordered work list. The main loop
            // records the exact robots rule instead of turning it into a
            // synthetic transport error.
            continue;
        }
        candidates.push((url, depth));
    }

    let mut tasks = JoinSet::new();
    for (url, _depth) in candidates {
        let client = client.clone();
        let base_host = base_host.to_owned();
        let scope_path = scope_path.map(str::to_owned);
        let allowed_hosts = allowed_hosts.to_vec();
        let config = config.clone();
        let max_response_bytes = config
            .max_response_bytes
            .unwrap_or(5_000_000)
            .clamp(1_024, 50_000_000);
        tasks.spawn(async move {
            let result = request_with_safe_redirects(
                &client,
                &url,
                &base_host,
                allow_subdomains,
                scope_path.as_deref(),
                &allowed_hosts,
                max_redirects,
                &config,
            )
            .await
            .map_err(|error| CrawlFetchFailure {
                kind: request_error_kind(&error),
                message: error.to_string(),
            });
            let result = match result {
                Ok(mut fetched) => {
                    if let FetchedPageBody::Http(response) = fetched.response {
                        let data = read_fetched_page_data(
                            FetchedPageBody::Http(response),
                            max_response_bytes,
                        )
                        .await;
                        fetched.response = FetchedPageBody::Prefetched(Box::new(data));
                    }
                    Ok(fetched)
                }
                Err(error) => Err(error),
            };
            (url, result)
        });
    }

    while let Some(joined) = tasks.join_next().await {
        match joined {
            Ok((url, result)) => {
                prefetched_responses.insert(url, result);
            }
            Err(error) => {
                // A task panic should remain visible as a page-level failure,
                // not silently remove a URL from the ordered queue.
                if let Some((url, _)) = prefetched_order
                    .iter()
                    .find(|(candidate, _)| !prefetched_responses.contains_key(candidate))
                {
                    prefetched_responses.insert(
                        url.clone(),
                        Err(CrawlFetchFailure {
                            kind: "prefetch_task".into(),
                            message: error.to_string(),
                        }),
                    );
                }
            }
        }
    }
}
