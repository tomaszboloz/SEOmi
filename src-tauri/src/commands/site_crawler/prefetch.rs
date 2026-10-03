use super::*;

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
