use super::*;

/// Native entry point shared by the interactive IPC command and the
/// scheduled desktop worker. The worker owns a short-lived `CrawlControl`
/// instance, so all existing cancellation/pause/progress checks remain in the
/// same crawler implementation without requiring a WebView.
#[allow(clippy::too_many_arguments)]
pub async fn crawl_site_with_control(
    app: AppHandle,
    control: &CrawlControl,
    start_url: String,
    max_pages: Option<usize>,
    user_agent: Option<String>,
    run_id: Option<String>,
    project_id: Option<String>,
    config: Option<CrawlConfig>,
) -> Result<SiteCrawlResult, String> {
    let start_time = Instant::now();

    let parsed_base = validate_and_normalize_url(&start_url).map_err(|e| e.to_string())?;

    let base_host = match parsed_base.host_str() {
        Some(h) => h.to_string(),
        None => return Err("URL has no valid hostname".into()),
    };

    let mut config = config.unwrap_or(CrawlConfig {
        crawl_mode: default_http_crawl_mode(),
        render_wait_for_selector: None,
        render_wait_delay_ms: None,
        render_lazy_scroll_cycles: None,
        max_pages,
        max_depth: None,
        include_patterns: Vec::new(),
        exclude_patterns: Vec::new(),
        allow_subdomains: false,
        allowed_hosts: Vec::new(),
        scope_path: None,
        keep_query_strings: false,
        respect_robots: true,
        respect_crawl_delay: true,
        discover_sitemaps: true,
        max_redirects: Some(10),
        follow_nofollow: false,
        max_response_bytes: Some(5_000_000),
        max_run_seconds: Some(300),
        request_timeout_secs: None,
        verify_ssl: true,
        seed_urls: Vec::new(),
        list_mode: false,
        user_agent: None,
        request_profile_id: None,
        trim_trailing_slash: false,
        lowercase_path: false,
        strip_tracking_parameters: false,
        allowed_query_parameters: Vec::new(),
        denied_query_parameters: Vec::new(),
        custom_searches: Vec::new(),
        focus_phrase: None,
        crawl_images: false,
        crawl_stylesheets: false,
        crawl_scripts: false,
        crawl_other_resources: false,
        max_resource_requests: Some(250),
        max_concurrent_requests: Some(4),
        resume_completed_urls: Vec::new(),
        resume_frontier_urls: Vec::new(),
    });
    config.allowed_hosts = normalize_allowed_hosts(&config.allowed_hosts)?;
    config.focus_phrase = config
        .focus_phrase
        .take()
        .map(|phrase| phrase.trim().chars().take(160).collect::<String>())
        .filter(|phrase| !phrase.is_empty());
    if !matches!(config.crawl_mode.as_str(), "http" | "browser-rendered") {
        return Err("Crawl mode must be either http or browser-rendered.".into());
    }
    let normalized_start_url = normalize_crawl_url(parsed_base.clone(), &config);
    let resume_completed_urls: HashSet<String> = config
        .resume_completed_urls
        .iter()
        .filter_map(|candidate| validate_and_normalize_url(candidate).ok())
        .map(|url| normalize_crawl_url(url, &config).to_string())
        .filter(|url| {
            url::Url::parse(url).ok().is_some_and(|parsed| {
                matches_scope(
                    &parsed,
                    &base_host,
                    config.allow_subdomains,
                    config.scope_path.as_deref(),
                    &config.allowed_hosts,
                )
            })
        })
        .take(20_000)
        .collect();
    let resume_frontier_urls: Vec<String> = config
        .resume_frontier_urls
        .iter()
        .filter_map(|candidate| validate_and_normalize_url(candidate).ok())
        .map(|url| normalize_crawl_url(url, &config).to_string())
        .filter(|url| !resume_completed_urls.contains(url))
        .take(20_000)
        .collect();
    validate_custom_searches(&config.custom_searches)?;
    let limit = config
        .max_pages
        .or(max_pages)
        .unwrap_or(25)
        .clamp(1, 10_000);
    let max_depth = config.max_depth.unwrap_or(usize::MAX).min(100);
    let max_redirects = config.max_redirects.unwrap_or(10).min(50);
    let max_response_bytes = config
        .max_response_bytes
        .unwrap_or(5_000_000)
        .clamp(1_024, 50_000_000);
    let max_run_seconds = config
        .max_run_seconds
        .map(|seconds| seconds.clamp(1, 3_600));
    let include_patterns =
        compile_filter_patterns(&config.include_patterns, "include").map_err(|error| {
            format!(
                "Invalid include filter `{}`: {}",
                error.pattern, error.message
            )
        })?;
    let exclude_patterns =
        compile_filter_patterns(&config.exclude_patterns, "exclude").map_err(|error| {
            format!(
                "Invalid exclude filter `{}`: {}",
                error.pattern, error.message
            )
        })?;
    let run_id = run_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    control.start(&run_id);

    let request_profile = match (project_id.as_deref(), config.request_profile_id.as_deref()) {
        (Some(project_id), Some(profile_id)) => Some(crawl_auth_profile(project_id, profile_id)?),
        (None, Some(_)) => {
            return Err("Select a project before using a saved request profile.".into())
        }
        _ => None,
    };
    if config.crawl_mode == "browser-rendered"
        && request_profile
            .as_ref()
            .is_some_and(rendered_profile_has_unsupported_transport)
    {
        return Err(
            "Browser-rendered crawl supports cookies from the selected profile only. Custom headers and proxy profiles require HTTP mode."
                .into(),
        );
    }
    let rendered_cookie = request_profile
        .as_ref()
        .and_then(|profile| profile.cookie.clone());
    let ua = config.user_agent.as_deref().filter(|value| !value.trim().is_empty()).map(str::to_owned)
        .or(user_agent)
        .unwrap_or_else(|| {
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 SEOmi/1.0".into()
    });
    if ua.len() > 1_024 {
        return Err("User-Agent cannot exceed 1024 characters.".into());
    }

    let mut headers = HeaderMap::new();
    let mut ua_value = HeaderValue::from_str(&ua).map_err(|_| "Invalid User-Agent value.")?;
    ua_value.set_sensitive(true);
    headers.insert(USER_AGENT, ua_value);
    let proxy_url = request_profile
        .as_ref()
        .and_then(|profile| profile.proxy_url.clone());
    if let Some(profile) = request_profile {
        for header in profile.headers {
            let name = HeaderName::from_bytes(header.name.trim().as_bytes())
                .map_err(|_| format!("Invalid custom header name `{}`.", header.name))?;
            let mut value = HeaderValue::from_str(&header.value)
                .map_err(|_| format!("Invalid value for custom header `{}`.", header.name))?;
            if name == reqwest::header::AUTHORIZATION
                || name.as_str().contains("token")
                || name.as_str().contains("key")
            {
                value.set_sensitive(true);
            }
            headers.append(name, value);
        }
        if let Some(cookie) = profile.cookie {
            let mut value = HeaderValue::from_str(&cookie)
                .map_err(|_| "Invalid cookie value in request profile.")?;
            value.set_sensitive(true);
            headers.insert(COOKIE, value);
        }
    }

    let mut client_builder = crate::services::http_client::public_client_builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(
            config.request_timeout_secs.unwrap_or(15).clamp(1, 300),
        ))
        // Redirects are recorded as evidence instead of silently followed. This
        // prevents a redirect from bypassing the URL validation boundary.
        .redirect(reqwest::redirect::Policy::none());
    if !config.verify_ssl {
        client_builder = client_builder.danger_accept_invalid_certs(true);
    }
    if let Some(proxy_url) = proxy_url {
        let proxy = reqwest::Proxy::all(&proxy_url)
            .map_err(|error| format!("Invalid proxy profile: {error}"))?;
        client_builder = client_builder.proxy(proxy);
    }
    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let (robots_rules, robots_txt_status, robots_sitemaps, robots_crawl_delay, robots_agent_matrix) =
        if config.respect_robots || config.discover_sitemaps {
            let robots_url = parsed_base
                .join("/robots.txt")
                .map_err(|error| format!("Failed to construct robots.txt URL: {error}"))?;
            match client.get(robots_url.clone()).send().await {
                Ok(response) if response.status().is_success() => {
                    match crate::services::http_client::read_bounded_text(
                        response,
                        max_response_bytes,
                    )
                    .await
                    {
                        Ok(content) => {
                            let rules = parse_robots_rules(&content, &ua);
                            let rule_count = rules.len();
                            let crawl_delay = parse_robots_crawl_delay(&content, &ua);
                            let delay_status = crawl_delay
                        .map(|delay| {
                            let seconds = delay.as_secs_f64();
                            if config.respect_robots && config.respect_crawl_delay {
                                format!("; crawl-delay {seconds:.3}s is enforced")
                            } else {
                                format!("; crawl-delay {seconds:.3}s is ignored by configuration")
                            }
                        })
                        .unwrap_or_default();
                            (
                                rules,
                                format!(
                                    "Loaded {rule_count} applicable robots.txt rules{delay_status}"
                                ),
                                parse_sitemap_directives(&content),
                                crawl_delay.filter(|_| {
                                    config.respect_robots && config.respect_crawl_delay
                                }),
                                build_robots_agent_matrix(&content, &ua),
                            )
                        }
                        Err(error) => (
                            Vec::new(),
                            format!("robots.txt could not be read ({error}); URLs allowed"),
                            Vec::new(),
                            None,
                            Vec::new(),
                        ),
                    }
                }
                Ok(response) if response.status().as_u16() == 404 => (
                    Vec::new(),
                    "robots.txt not found; URLs allowed".into(),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
                Ok(response) => (
                    Vec::new(),
                    format!(
                        "robots.txt returned HTTP {}; URLs allowed",
                        response.status()
                    ),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
                Err(error) => (
                    Vec::new(),
                    format!("robots.txt unavailable ({error}); URLs allowed"),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
            }
        } else {
            (
                Vec::new(),
                "robots.txt checking disabled by this crawl configuration".into(),
                Vec::new(),
                None,
                Vec::new(),
            )
        };
    let robots_applicable_rules = robots_rules
        .iter()
        .map(|rule| CrawledRobotsRule {
            directive: if rule.allow { "allow" } else { "disallow" }.into(),
            path: rule.path.clone(),
        })
        .collect::<Vec<_>>();
    let robots_sitemap_directives = robots_sitemaps.clone();

    let mut timed_out = false;
    let mut sitemap_urls = Vec::new();
    let mut discovery_sources_by_url: HashMap<String, Vec<CrawledDiscoverySource>> = HashMap::new();
    let mut discovery_provenance_truncated = false;
    let sitemap_status = if config.discover_sitemaps {
        let candidates = if robots_sitemaps.is_empty() {
            vec![parsed_base
                .join("/sitemap.xml")
                .map_err(|error| format!("Failed to construct sitemap URL: {error}"))?
                .to_string()]
        } else {
            robots_sitemaps
        };
        let mut sources_loaded = 0usize;
        let mut sources_failed = 0usize;
        let mut sitemap_queue: VecDeque<String> = candidates.into_iter().collect();
        let mut visited_sitemaps = HashSet::new();
        while let Some(candidate) = sitemap_queue.pop_front() {
            if crawl_deadline_reached(start_time, max_run_seconds) {
                timed_out = true;
                break;
            }
            if visited_sitemaps.len() >= 20 || !visited_sitemaps.insert(candidate.clone()) {
                continue;
            }
            let Ok(sitemap_url) = validate_and_normalize_url(&candidate) else {
                continue;
            };
            if !matches_scope(
                &sitemap_url,
                &base_host,
                config.allow_subdomains,
                None,
                &config.allowed_hosts,
            ) {
                continue;
            }
            if let Ok(response) = client.get(sitemap_url.clone()).send().await {
                if response.status().is_success() {
                    let content = match crate::services::http_client::read_bounded_text(
                        response,
                        max_response_bytes,
                    )
                    .await
                    {
                        Ok(content) => content,
                        Err(_) => {
                            sources_failed += 1;
                            continue;
                        }
                    };
                    sources_loaded += 1;
                    let locations = parse_sitemap_locations(&content);
                    let is_index = content.to_ascii_lowercase().contains("<sitemapindex");
                    for location in locations {
                        if let Ok(url) = validate_and_normalize_url(&location) {
                            if matches_scope(
                                &url,
                                &base_host,
                                config.allow_subdomains,
                                config.scope_path.as_deref(),
                                &config.allowed_hosts,
                            ) {
                                if is_index {
                                    sitemap_queue.push_back(url.to_string());
                                } else {
                                    let normalized = normalize_crawl_url(url, &config);
                                    if sitemap_urls.len() < 10_000 {
                                        let normalized_url = normalized.to_string();
                                        sitemap_urls.push(normalized_url.clone());
                                        discovery_provenance_truncated |= !record_discovery_source(
                                            &mut discovery_sources_by_url,
                                            &normalized_url,
                                            CrawledDiscoverySource {
                                                kind: "sitemap".into(),
                                                source_url: Some(sitemap_url.to_string()),
                                                anchor_text: None,
                                            },
                                        );
                                    } else {
                                        discovery_provenance_truncated = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        sitemap_urls.sort();
        sitemap_urls.dedup();
        format!(
            "Loaded {sources_loaded} sitemap source(s), found {} in-scope URL(s); {sources_failed} source body read(s) failed or exceeded the safety limit",
            sitemap_urls.len()
        )
    } else {
        "Sitemap discovery disabled by this crawl configuration".into()
    };

    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();
    let mut pages: Vec<CrawledPageSummary> = Vec::new();
    let mut rejected_urls: Vec<RejectedCrawlUrl> = Vec::new();

    let mut seed_candidates = if config.list_mode {
        config.seed_urls.clone()
    } else {
        vec![normalized_start_url.to_string()]
    };
    if !config.list_mode {
        seed_candidates.extend(sitemap_urls.iter().cloned());
    }
    seed_candidates.extend(resume_frontier_urls.iter().cloned());
    for candidate in seed_candidates {
        let url = match validate_and_normalize_url(&candidate) {
            Ok(url) => url,
            Err(error) => {
                rejected_urls.push(RejectedCrawlUrl {
                    url: candidate,
                    reason: format!("Rejected by URL safety validation: {error}"),
                });
                continue;
            }
        };
        if !matches_scope(
            &url,
            &base_host,
            config.allow_subdomains,
            config.scope_path.as_deref(),
            &config.allowed_hosts,
        ) {
            rejected_urls.push(RejectedCrawlUrl {
                url: candidate,
                reason: "Outside configured crawl scope".into(),
            });
            continue;
        }
        let normalized = normalize_crawl_url(url, &config).to_string();
        if !matches_filters(&normalized, &include_patterns, &exclude_patterns) {
            rejected_urls.push(RejectedCrawlUrl {
                url: normalized,
                reason: "Excluded by crawl filter".into(),
            });
            continue;
        }
        if resume_completed_urls.contains(&normalized) {
            // Keep checkpointed URLs in the visited set so links from newly
            // fetched pages cannot enqueue them a second time.
            visited.insert(normalized);
            continue;
        }
        let is_start_url = !config.list_mode && normalized == normalized_start_url.to_string();
        if is_start_url {
            discovery_provenance_truncated |= !record_discovery_source(
                &mut discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "start".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        } else if config.list_mode {
            discovery_provenance_truncated |= !record_discovery_source(
                &mut discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "seed".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        } else if !discovery_sources_by_url.contains_key(&normalized) {
            // Keep a truthful fallback for a sitemap URL whose source document
            // could not be retained, rather than silently presenting it as a
            // start URL.
            discovery_provenance_truncated |= !record_discovery_source(
                &mut discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "sitemap".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        }
        if visited.insert(normalized.clone()) {
            queue.push_back((normalized, 0));
        }
    }

    let a_selector = Selector::parse("a[href]").unwrap();
    let title_selector = Selector::parse("title").unwrap();
    let h1_selector = Selector::parse("h1").unwrap();
    let headings_selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();
    let meta_desc_selector = Selector::parse("meta[name='description']").unwrap();
    let canonical_selector = Selector::parse("link[rel][href]").unwrap();
    let robots_selector = Selector::parse("meta[name='robots']").unwrap();
    let meta_refresh_selector = Selector::parse("meta[http-equiv]").unwrap();
    let image_selector = Selector::parse("img[src]").unwrap();
    let script_src_selector = Selector::parse("script[src]").unwrap();
    let link_href_selector = Selector::parse("link[href]").unwrap();
    let media_src_selector = Selector::parse("source[src], video[src], audio[src]").unwrap();
    let html_selector = Selector::parse("html").unwrap();
    let hreflang_selector = Selector::parse("link[hreflang][href]").unwrap();
    let mut robots_blocked_count = 0usize;
    let mut depth_limit_reached = false;
    let mut last_page_request_at: Option<Instant> = None;
    let mut resource_candidates: HashMap<String, ResourceCandidate> = HashMap::new();
    let mut custom_search_remaining_chars = MAX_CUSTOM_SEARCH_CHARS_PER_RUN;
    let mut rendered_session: Option<RenderedCrawlerSession> = None;
    let mut rendered_init_error: Option<String> = None;
    let html_parallelism = if config.crawl_mode == "http" && robots_crawl_delay.is_none() {
        config.max_concurrent_requests.unwrap_or(1).clamp(1, 16)
    } else {
        1
    };
    let mut prefetched_order: VecDeque<(String, usize)> = VecDeque::new();
    let mut prefetched_responses: HashMap<String, Result<FetchedResponse, CrawlFetchFailure>> =
        HashMap::new();

    while let Some((current_url, depth)) =
        prefetched_order.pop_front().or_else(|| queue.pop_front())
    {
        if crawl_deadline_reached(start_time, max_run_seconds) {
            timed_out = true;
            break;
        }
        if !control.wait_until_resumed(&run_id).await {
            break;
        }
        if pages.len() >= limit {
            break;
        }
        if resume_completed_urls.contains(&current_url) {
            continue;
        }

        let current_parsed = url::Url::parse(&current_url)
            .map_err(|error| format!("Failed to parse queued URL: {error}"))?;
        if config.respect_robots && !robots_allows(&current_parsed, &robots_rules) {
            robots_blocked_count += 1;
            let rule = robots_deciding_rule(&current_parsed, &robots_rules)
                .expect("a disallowed URL has a matching robots.txt rule");
            rejected_urls.push(RejectedCrawlUrl {
                url: current_url,
                reason: format!("Blocked by robots.txt Disallow rule: {}", rule.path),
            });
            continue;
        }

        if control.is_cancelled(&run_id) {
            break;
        }
        let _ = app.emit(
            "crawl-progress",
            CrawlProgress {
                run_id: run_id.clone(),
                current_url: Some(current_url.clone()),
                discovered: visited.len(),
                completed: pages.len(),
                // Prefetched URLs are removed from `queue` while their
                // responses wait for deterministic parsing. Count both
                // collections so the desktop UI never reports an empty
                // queue while bounded parallel work is still pending.
                queued: queue.len() + prefetched_order.len(),
                cancelled: false,
                paused: false,
                elapsed_ms: start_time.elapsed().as_millis() as u64,
                pages_per_second: {
                    let elapsed_seconds = start_time.elapsed().as_secs_f64();
                    if elapsed_seconds > 0.0 {
                        pages.len() as f64 / elapsed_seconds
                    } else {
                        0.0
                    }
                },
            },
        );

        if let (Some(delay), Some(last_request_at)) = (robots_crawl_delay, last_page_request_at) {
            if !wait_for_crawl_delay(control, &run_id, last_request_at, delay).await {
                break;
            }
        }
        let page_start = Instant::now();
        last_page_request_at = Some(page_start);
        let prefetched_response = prefetched_responses.remove(&current_url);
        let resp: Result<FetchedResponse, CrawlFetchFailure> = if let Some(response) =
            prefetched_response
        {
            response
        } else if config.crawl_mode == "browser-rendered" {
            if rendered_session.is_none() && rendered_init_error.is_none() {
                let options = RenderOptions {
                    user_agent: Some(ua.clone()),
                    cookie: rendered_cookie.clone(),
                    wait_for_selector: config
                        .render_wait_for_selector
                        .as_deref()
                        .map(str::trim)
                        .filter(|selector| !selector.is_empty())
                        .map(|selector| selector.chars().take(512).collect()),
                    wait_delay_ms: config.render_wait_delay_ms.unwrap_or(0).min(10_000),
                    lazy_scroll_cycles: config.render_lazy_scroll_cycles.unwrap_or(0).min(40),
                };
                match RenderedCrawlerSession::open(
                    &app,
                    &current_url,
                    &base_host,
                    config.allow_subdomains,
                    config.scope_path.as_deref(),
                    options,
                )
                .await
                {
                    Ok(session) => rendered_session = Some(session),
                    Err(message) => rendered_init_error = Some(message),
                }
            }
            if let Some(message) = &rendered_init_error {
                Err(CrawlFetchFailure {
                    kind: "browser_render".into(),
                    message: message.clone(),
                })
            } else {
                let render_timeout = max_run_seconds
                    .map(|seconds| {
                        std::time::Duration::from_secs(seconds).saturating_sub(start_time.elapsed())
                    })
                    .unwrap_or(std::time::Duration::from_secs(60))
                    .min(std::time::Duration::from_secs(60));
                let capture = rendered_session
                    .as_mut()
                    .expect("rendered session initialized")
                    .capture(&current_url);
                tokio::select! {
                    result = capture => result
                        .map(|snapshot| {
                            let final_url = snapshot.final_url.clone();
                            FetchedResponse {
                                response: FetchedPageBody::Rendered(snapshot),
                                final_url,
                                redirect_chain: Vec::new(),
                                redirect_stopped_reason: None,
                            }
                        })
                        .map_err(|message| CrawlFetchFailure { kind: "browser_render".into(), message }),
                    _ = wait_for_crawl_cancellation(control, &run_id) => Err(CrawlFetchFailure {
                        kind: "cancelled".into(),
                        message: "Crawl was cancelled during page rendering.".into(),
                    }),
                    _ = tokio::time::sleep(render_timeout) => {
                        timed_out = true;
                        Err(CrawlFetchFailure {
                            kind: "timeout".into(),
                            message: "Rendered page exceeded the remaining crawl time.".into(),
                        })
                    }
                }
            }
        } else {
            request_with_safe_redirects(
                &client,
                &current_url,
                &base_host,
                config.allow_subdomains,
                config.scope_path.as_deref(),
                &config.allowed_hosts,
                max_redirects,
                &config,
            )
            .await
            .map_err(|error| CrawlFetchFailure {
                kind: request_error_kind(&error),
                message: error.to_string(),
            })
        };
        let page_duration = page_start.elapsed().as_millis() as u64;

        let mut issues: Vec<CrawledPageIssue> = Vec::new();

        match resp {
            Ok(fetched) => {
                let final_url = fetched.final_url;
                let redirect_chain = fetched.redirect_chain;
                let redirect_stopped_reason = fetched.redirect_stopped_reason;
                let FetchedPageData {
                    status,
                    content_type,
                    content_length,
                    content_encoding,
                    http_refresh,
                    cache_control,
                    charset,
                    x_robots_tag,
                    declared_html,
                    body_truncated,
                    body_read_failed,
                    body,
                    rendered_diagnostics,
                    browser_navigation_time_ms,
                    rendered_lcp_ms,
                    rendered_inp_ms,
                    rendered_cls,
                } = read_fetched_page_data(fetched.response, max_response_bytes).await;
                let page_duration = browser_navigation_time_ms.unwrap_or(page_duration);
                let is_html = declared_html && !body_truncated && !body_read_failed;
                if status >= 400 {
                    issues.push(CrawledPageIssue {
                        severity: "Critical".into(),
                        message: format!("HTTP error status {}", status),
                    });
                }

                if !redirect_chain.is_empty() {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!("Safely followed {} redirect(s)", redirect_chain.len()),
                    });
                }
                if let Some(reason) = redirect_stopped_reason.as_ref() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: reason.clone(),
                    });
                }
                if config.crawl_mode == "browser-rendered" && final_url != current_url {
                    issues.push(CrawledPageIssue { severity: "Info".into(), message: "Browser navigation ended at a different URL; intermediate redirect hops are unavailable in rendered mode".into() });
                }
                if status == 0 && config.crawl_mode == "browser-rendered" {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message:
                            "Browser did not expose the HTTP status for this rendered response"
                                .into(),
                    });
                }
                if let Some((failed_resources, console_errors)) = rendered_diagnostics {
                    for resource in failed_resources.into_iter().take(10) {
                        issues.push(CrawledPageIssue {
                            severity: "Info".into(),
                            message: format!("Browser failed to load a page resource: {resource}"),
                        });
                    }
                    for error in console_errors.into_iter().take(10) {
                        issues.push(CrawledPageIssue {
                            severity: "Info".into(),
                            message: format!("Browser console error: {error}"),
                        });
                    }
                }
                if !declared_html {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Non-HTML resource: HTML SEO checks were skipped".into(),
                    });
                }
                if body_truncated {
                    issues.push(CrawledPageIssue { severity: "Warning".into(), message: format!("Response body exceeded the configured {} byte limit; HTML checks were skipped", max_response_bytes) });
                }
                if body_read_failed {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message:
                            "Response body could not be read completely; HTML checks were skipped"
                                .into(),
                    });
                }

                let (text, detected_charset, mut html_validation_findings) = if is_html {
                    decode_crawl_html_body(&body, charset.as_deref())
                } else {
                    (
                        String::from_utf8_lossy(&body).into_owned(),
                        None,
                        Vec::new(),
                    )
                };
                let document = Html::parse_document(&text);
                let (html_findings, html_validation_truncated) = if is_html {
                    validate_crawl_html_with_charset(
                        &document,
                        &text,
                        &url::Url::parse(&final_url).unwrap_or_else(|_| current_parsed.clone()),
                        charset.as_deref(),
                    )
                } else {
                    (Vec::new(), false)
                };
                html_validation_findings.extend(html_findings);
                let custom_search_results = if is_html {
                    extract_custom_search_results_with_html(
                        &document,
                        Some(&text),
                        &config.custom_searches,
                        &mut custom_search_remaining_chars,
                    )
                } else {
                    Vec::new()
                };
                let document_language = document
                    .select(&html_selector)
                    .next()
                    .and_then(|element| element.value().attr("lang"))
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned);
                if is_html && document_language.is_none() {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Document has no html lang attribute".into(),
                    });
                }
                let final_base = url::Url::parse(&final_url)
                    .map_err(|error| format!("Failed to parse final URL: {error}"))?;
                let (favicons, social_meta_tags, favicon_metadata) = if is_html {
                    let (urls, social) = crawl_social_metadata(&document, &final_base);
                    (urls, social, crawl_favicon_metadata(&document, &final_base))
                } else {
                    (Vec::new(), Vec::new(), Vec::new())
                };
                let (frames, frames_truncated) = if is_html {
                    crawl_frames(&document, &final_base)
                } else {
                    (Vec::new(), false)
                };
                let favicon_resource_checks = favicons
                    .iter()
                    .map(|favicon| unchecked_social_resource(favicon))
                    .collect::<Vec<_>>();
                for favicon in &favicon_resource_checks {
                    add_resource_candidate(
                        &mut resource_candidates,
                        &final_url,
                        &final_base,
                        &favicon.url,
                        "image",
                        &base_host,
                        &config,
                    );
                }
                for social_image in social_meta_tags
                    .iter()
                    .filter_map(|tag| tag.resource_check.as_ref())
                {
                    add_resource_candidate(
                        &mut resource_candidates,
                        &final_url,
                        &final_base,
                        &social_image.url,
                        "image",
                        &base_host,
                        &config,
                    );
                }
                let mut hreflangs = Vec::new();
                for element in document.select(&hreflang_selector) {
                    let Some(language) = element
                        .value()
                        .attr("hreflang")
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                    else {
                        continue;
                    };
                    let Some(href) = element.value().attr("href") else {
                        continue;
                    };
                    if let Ok(target) = final_base.join(href) {
                        hreflangs.push(CrawledHreflang {
                            language: language.to_string(),
                            target_url: target.to_string(),
                            target_http_status: None,
                            target_checked_in_run: false,
                            reciprocal_in_run: None,
                            target_canonical_alignment: None,
                        });
                    }
                }
                hreflangs.sort_by(|left, right| {
                    left.language
                        .cmp(&right.language)
                        .then(left.target_url.cmp(&right.target_url))
                });
                let amp_url = document
                    .select(&canonical_selector)
                    .find_map(|element| {
                        let rel = element.value().attr("rel")?;
                        rel.split_ascii_whitespace()
                            .any(|value| value.eq_ignore_ascii_case("amphtml"))
                            .then(|| element.value().attr("href"))
                            .flatten()
                    })
                    .and_then(|href| final_base.join(href).ok())
                    .map(|url| url.to_string());
                let (
                    pagination_links,
                    pagination_declaration_count,
                    pagination_invalid_declaration_count,
                ) = crawl_pagination_links(&document, &final_base);
                let pagination_next = pagination_links
                    .iter()
                    .find(|link| link.relation == "next")
                    .map(|link| link.target_url.clone());
                let pagination_prev = pagination_links
                    .iter()
                    .find(|link| link.relation == "prev")
                    .map(|link| link.target_url.clone());
                let content_metrics = if is_html {
                    content_metrics(&document, body.len(), document_language.as_deref())
                } else {
                    ContentMetrics::default()
                };
                let word_count = content_metrics.word_count;
                let content_hash = content_metrics.content_hash.clone();
                let text_ratio_percent = content_metrics.text_ratio_percent;
                let reading_time_minutes = content_metrics.reading_time_minutes;
                let content_simhash = is_html.then(|| content_simhash(&document)).flatten();
                let semantic_terms = if is_html {
                    extract_semantic_terms(&document)
                } else {
                    Vec::new()
                };
                let semantic_excerpts = if is_html {
                    extract_semantic_excerpts(&document)
                } else {
                    Vec::new()
                };
                let has_primary_content_root = is_html && has_semantic_content_root(&document);
                let semantic_content_source =
                    semantic_content_source(&document, is_html, body_truncated, body_read_failed);
                let (
                    schema_types,
                    schema_syntax_errors,
                    schema_validation_findings,
                    schema_references,
                    schema_validation_truncated,
                ) = if is_html {
                    inspect_page_schema(&document)
                } else {
                    (Vec::new(), 0, Vec::new(), Vec::new(), false)
                };
                if schema_syntax_errors > 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("{} invalid JSON-LD block(s)", schema_syntax_errors),
                    });
                }
                if is_html && word_count < 50 {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!("Thin text content: {word_count} words"),
                    });
                }

                // Title check
                let titles = document
                    .select(&title_selector)
                    .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
                    .collect::<Vec<_>>();
                let title = titles.first().cloned();
                let title_length = title.as_deref().map(|value| value.chars().count());

                if is_html
                    && (title.is_none() || title.as_ref().map(|t| t.is_empty()).unwrap_or(true))
                {
                    issues.push(CrawledPageIssue {
                        severity: "Critical".into(),
                        message: "Missing <title> tag".into(),
                    });
                }
                if is_html && titles.len() > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("Multiple <title> tags found ({})", titles.len()),
                    });
                }
                if is_html && title_length.is_some_and(|length| !(30..=60).contains(&length)) {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Title length is {} characters; reference range is 30–60",
                            title_length.unwrap_or_default()
                        ),
                    });
                }

                // H1 check
                let h1_count = document.select(&h1_selector).count();
                let heading_levels = document
                    .select(&headings_selector)
                    .filter_map(|element| element.value().name().strip_prefix('h'))
                    .filter_map(|value| value.parse::<usize>().ok())
                    .collect::<Vec<_>>();
                let mut heading_counts = vec![0usize; 6];
                for level in &heading_levels {
                    if (1..=6).contains(level) {
                        heading_counts[*level - 1] += 1;
                    }
                }
                let duplicate_headings = if is_html {
                    duplicate_heading_groups(&document, &headings_selector)
                } else {
                    Vec::new()
                };
                for duplicate in &duplicate_headings {
                    let levels = duplicate
                        .levels
                        .iter()
                        .map(|level| format!("H{level}"))
                        .collect::<Vec<_>>()
                        .join("/");
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Repeated heading text {:?} across {levels} ({} occurrences)",
                            duplicate.text, duplicate.occurrences
                        ),
                    });
                }
                if is_html && h1_count == 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: "Missing <h1> tag".into(),
                    });
                } else if is_html && h1_count > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("Multiple <h1> tags found ({})", h1_count),
                    });
                }
                if is_html
                    && heading_levels
                        .windows(2)
                        .any(|levels| levels[1] > levels[0] + 1)
                {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Heading hierarchy skips one or more levels".into(),
                    });
                }

                // Meta description check
                let meta_descriptions = document
                    .select(&meta_desc_selector)
                    .filter_map(|element| element.value().attr("content"))
                    .map(str::trim)
                    .map(str::to_owned)
                    .collect::<Vec<_>>();
                let meta_description = meta_descriptions
                    .first()
                    .filter(|value| !value.is_empty())
                    .cloned();
                let meta_description_length = meta_description
                    .as_deref()
                    .map(|value| value.chars().count());
                let focus_phrase = if is_html {
                    focus_phrase_evidence(
                        &document,
                        title.as_deref(),
                        meta_description.as_deref(),
                        config.focus_phrase.as_deref(),
                    )
                } else {
                    None
                };
                if is_html && meta_descriptions.is_empty() {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Missing meta description tag".into(),
                    });
                } else if is_html && meta_description.is_none() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: "Meta description is empty".into(),
                    });
                }
                if is_html && meta_descriptions.len() > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Multiple meta description tags found ({})",
                            meta_descriptions.len()
                        ),
                    });
                }
                if is_html
                    && meta_description_length.is_some_and(|length| !(70..=160).contains(&length))
                {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Meta description length is {} characters; reference range is 70–160",
                            meta_description_length.unwrap_or_default()
                        ),
                    });
                }

                let (canonical_declaration_count, canonical_urls) =
                    crawl_canonical_declarations(&document, &final_base);
                let canonical = canonical_urls.first().cloned();
                if is_html && canonical_declaration_count == 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Missing canonical link".into(),
                    });
                }
                if is_html && canonical_declaration_count > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Multiple canonical links found ({})",
                            canonical_declaration_count
                        ),
                    });
                } else if is_html && canonical_declaration_count == 1 && canonical.is_none() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: "Canonical declaration has a missing, invalid, or non-HTTP URL"
                            .into(),
                    });
                }

                let meta_robots = document
                    .select(&robots_selector)
                    .next()
                    .and_then(|element| element.value().attr("content"))
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned);
                let meta_refreshes = document
                    .select(&meta_refresh_selector)
                    .filter_map(|element| {
                        element
                            .value()
                            .attr("http-equiv")
                            .filter(|value| value.eq_ignore_ascii_case("refresh"))
                            .and_then(|_| element.value().attr("content"))
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                    })
                    .collect::<Vec<_>>();
                let mut client_redirects = meta_refreshes
                    .iter()
                    .map(|declaration| {
                        parse_client_redirect("meta-refresh", declaration, &final_base)
                    })
                    .collect::<Vec<_>>();
                if let Some(declaration) = http_refresh {
                    client_redirects.push(parse_client_redirect(
                        "http-refresh",
                        &declaration,
                        &final_base,
                    ));
                }
                client_redirects.extend(extract_javascript_redirects(&document, &final_base));
                if !client_redirects.is_empty() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Client-side refresh redirect detected ({} declaration(s))",
                            client_redirects.len()
                        ),
                    });
                }
                let meta_noindex = meta_robots
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("noindex"));
                let header_noindex = x_robots_tag
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("noindex"));
                let meta_nofollow = meta_robots
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("nofollow"));
                let header_nofollow = x_robots_tag
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("nofollow"));
                if meta_noindex {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Page declares noindex in meta robots".into(),
                    });
                }
                if header_noindex {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Response declares noindex in X-Robots-Tag".into(),
                    });
                }
                if meta_nofollow {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Page declares nofollow in meta robots".into(),
                    });
                }
                if header_nofollow {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Response declares nofollow in X-Robots-Tag".into(),
                    });
                }
                let canonical_points_elsewhere = canonical.as_deref().is_some_and(|target| {
                    classify_canonical_relation(&final_url, 1, &[target.to_string()]) != "self"
                });
                let canonical_relation = classify_canonical_relation(
                    &final_url,
                    canonical_declaration_count,
                    &canonical_urls,
                );
                let pagination_canonical_alignment = (pagination_declaration_count > 0)
                    .then(|| pagination_canonical_alignment(canonical_relation))
                    .flatten();
                if is_html && pagination_invalid_declaration_count > 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "{} pagination declaration(s) have a missing or invalid HTTP(S) target",
                            pagination_invalid_declaration_count
                        ),
                    });
                }
                let canonical_targets = canonical_urls
                    .iter()
                    .map(|target| CrawledCanonicalTarget {
                        url: target.clone(),
                        relation: classify_canonical_relation(
                            &final_url,
                            1,
                            std::slice::from_ref(target),
                        )
                        .to_string(),
                        http_status: None,
                        checked_in_run: false,
                    })
                    .collect::<Vec<_>>();
                let canonical_robots_conflict =
                    canonical.is_some() && (meta_noindex || header_noindex);
                if is_html && canonical_points_elsewhere {
                    issues.push(CrawledPageIssue { severity: "Info".into(), message: "Canonical points to a different URL; the target was not validated in this verdict".into() });
                }
                if is_html && canonical_robots_conflict {
                    issues.push(CrawledPageIssue { severity: "Warning".into(), message: "Canonical and noindex are both present; review the intended indexing signal".into() });
                }
                let indexability_status = if status == 0 && config.crawl_mode == "browser-rendered"
                {
                    "HTTP status unavailable from rendered document".to_string()
                } else if status >= 400 {
                    "Blocked by HTTP error".to_string()
                } else if meta_noindex || header_noindex {
                    "Excluded by robots directive".to_string()
                } else if canonical_points_elsewhere {
                    "Canonical points to a different URL".to_string()
                } else if meta_nofollow || header_nofollow {
                    "Eligible from this response only; link following is restricted".to_string()
                } else if status >= 300 {
                    "Redirect response — target not evaluated".to_string()
                } else if config.crawl_mode == "browser-rendered" {
                    "Rendered DOM checked; X-Robots-Tag response header unavailable".to_string()
                } else {
                    "Eligible from this response only".to_string()
                };
                let robots_decision = Some(build_robots_decision(
                    meta_robots.as_deref(),
                    x_robots_tag.as_deref(),
                    config.crawl_mode != "browser-rendered",
                ));
                let indexability_verdict = Some(build_indexability_verdict(
                    status,
                    &config.crawl_mode,
                    meta_noindex,
                    header_noindex,
                    canonical_points_elsewhere,
                    meta_nofollow,
                    header_nofollow,
                ));

                // Extract internal links to queue
                let mut internal_link_count = 0usize;
                let mut external_link_count = 0usize;
                let mut links = Vec::new();
                let mut semantic_links = Vec::new();
                let mut images = Vec::new();
                if is_html {
                    let current_base = final_base;
                    for element in document.select(&a_selector) {
                        if let Some(href) = element.value().attr("href") {
                            if href.starts_with('#')
                                || href.starts_with("javascript:")
                                || href.starts_with("mailto:")
                            {
                                continue;
                            }

                            if let Ok(resolved) = current_base.join(href) {
                                if resolved.scheme() == "http" || resolved.scheme() == "https" {
                                    let is_internal = matches_scope(
                                        &resolved,
                                        &base_host,
                                        config.allow_subdomains,
                                        config.scope_path.as_deref(),
                                        &config.allowed_hosts,
                                    );
                                    let anchor_text = element
                                        .text()
                                        .collect::<Vec<_>>()
                                        .join(" ")
                                        .split_whitespace()
                                        .collect::<Vec<_>>()
                                        .join(" ");
                                    let is_semantic_content_link = semantic_content_contains(
                                        &element,
                                        has_primary_content_root,
                                    );
                                    let rel = element.value().attr("rel").map(str::to_owned);
                                    let source_excerpt = bounded_link_source_excerpt(&element);
                                    let is_nofollow = rel.as_deref().is_some_and(|value| {
                                        value
                                            .split_ascii_whitespace()
                                            .any(|token| token.eq_ignore_ascii_case("nofollow"))
                                    });
                                    let target_for_run =
                                        normalize_crawl_url(resolved.clone(), &config);
                                    if is_internal {
                                        discovery_provenance_truncated |= !record_discovery_source(
                                            &mut discovery_sources_by_url,
                                            target_for_run.as_str(),
                                            CrawledDiscoverySource {
                                                kind: "link".into(),
                                                source_url: Some(final_url.clone()),
                                                anchor_text: (!anchor_text.is_empty())
                                                    .then_some(anchor_text.clone()),
                                            },
                                        );
                                    }
                                    if links.len() < 5_000 {
                                        links.push(CrawledLink {
                                            target_url: target_for_run.to_string(),
                                            anchor_text: anchor_text.clone(),
                                            rel: rel.clone(),
                                            is_internal,
                                            source_excerpt: source_excerpt.clone(),
                                            target_http_status: None,
                                            target_response_time_ms: None,
                                            target_redirect_url: None,
                                            target_request_error_kind: None,
                                            target_checked_at: None,
                                        });
                                    }
                                    if is_internal
                                        && is_semantic_content_link
                                        && semantic_links.len()
                                            < MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE
                                    {
                                        semantic_links.push(CrawledLink {
                                            target_url: target_for_run.to_string(),
                                            anchor_text,
                                            rel,
                                            is_internal: true,
                                            source_excerpt,
                                            target_http_status: None,
                                            target_response_time_ms: None,
                                            target_redirect_url: None,
                                            target_request_error_kind: None,
                                            target_checked_at: None,
                                        });
                                    }
                                    if is_other_resource_url(&resolved) {
                                        add_resource_candidate(
                                            &mut resource_candidates,
                                            &final_url,
                                            &current_base,
                                            href,
                                            "other",
                                            &base_host,
                                            &config,
                                        );
                                    }
                                    if is_internal {
                                        internal_link_count += 1;
                                        let url_str =
                                            normalize_crawl_url(resolved.clone(), &config)
                                                .to_string();

                                        if !config.list_mode
                                            && depth >= max_depth
                                            && (config.follow_nofollow || !is_nofollow)
                                            && matches_filters(
                                                &url_str,
                                                &include_patterns,
                                                &exclude_patterns,
                                            )
                                            && !visited.contains(&url_str)
                                        {
                                            depth_limit_reached = true;
                                        }

                                        if !config.list_mode
                                            && depth < max_depth
                                            && (config.follow_nofollow || !is_nofollow)
                                            && matches_filters(
                                                &url_str,
                                                &include_patterns,
                                                &exclude_patterns,
                                            )
                                            && !visited.contains(&url_str)
                                            && queue.len() + pages.len() < limit * 2
                                        {
                                            visited.insert(url_str.clone());
                                            queue.push_back((url_str, depth + 1));
                                        }
                                    } else {
                                        external_link_count += 1;
                                    }
                                }
                            }
                        }
                    }
                    let mut missing_alt_count = 0usize;
                    for element in document.select(&image_selector) {
                        let Some(src) = element.value().attr("src") else {
                            continue;
                        };
                        let src = src.trim();
                        let inline_image = src.to_ascii_lowercase().starts_with("data:image/");
                        let resolved = current_base
                            .join(src)
                            .ok()
                            .filter(|url| url.scheme() == "http" || url.scheme() == "https");
                        if resolved.is_none() && !inline_image {
                            continue;
                        }
                        let alt = element.value().attr("alt").map(str::to_owned);
                        let srcset = element.value().attr("srcset").map(str::to_owned);
                        let inline_dimensions =
                            inline_image.then(|| inline_image_dimensions(src)).flatten();
                        let attribute_width = element
                            .value()
                            .attr("width")
                            .and_then(|value| value.trim().parse().ok());
                        let attribute_height = element
                            .value()
                            .attr("height")
                            .and_then(|value| value.trim().parse().ok());
                        let width =
                            attribute_width.or_else(|| inline_dimensions.map(|value| value.0));
                        let height =
                            attribute_height.or_else(|| inline_dimensions.map(|value| value.1));
                        let dimensions_source =
                            if attribute_width.is_some() && attribute_height.is_some() {
                                Some("attributes".to_string())
                            } else if inline_dimensions.is_some() {
                                Some(
                                    if attribute_width.is_some() || attribute_height.is_some() {
                                        "mixed"
                                    } else {
                                        "intrinsic-data-uri"
                                    }
                                    .to_string(),
                                )
                            } else {
                                None
                            };
                        let parsed_srcset_urls =
                            srcset.as_deref().map(parse_srcset_urls).unwrap_or_default();
                        let srcset_resource_checks = parsed_srcset_urls
                            .iter()
                            .take(MAX_SRCSET_CANDIDATES_PER_IMAGE)
                            .filter_map(|candidate| {
                                let resolved = current_base.join(candidate).ok()?;
                                (resolved.scheme() == "http" || resolved.scheme() == "https").then(
                                    || CrawledImageResourceCheck {
                                        url: resolved.to_string(),
                                        checked_in_run: false,
                                        http_status: None,
                                        content_length: None,
                                        request_error_kind: None,
                                    },
                                )
                            })
                            .collect::<Vec<_>>();
                        if alt.is_none() {
                            missing_alt_count += 1;
                        }
                        if images.len() < 5_000 {
                            images.push(CrawledImage {
                                src: resolved
                                    .as_ref()
                                    .map(ToString::to_string)
                                    .unwrap_or_else(|| bounded_inline_image_uri(src)),
                                alt,
                                srcset,
                                format: if inline_image {
                                    inline_image_format(src)
                                } else {
                                    resolved.as_ref().and_then(|url| {
                                        url.path()
                                            .rsplit('.')
                                            .next()
                                            .filter(|extension| *extension != url.path())
                                            .map(|extension| extension.to_ascii_lowercase())
                                    })
                                },
                                width,
                                height,
                                dimensions_source,
                                lazy_loaded: element
                                    .value()
                                    .attr("loading")
                                    .is_some_and(|value| value.eq_ignore_ascii_case("lazy")),
                                checked_in_run: false,
                                http_status: None,
                                content_length: None,
                                request_error_kind: None,
                                srcset_resource_checks,
                                srcset_resource_checks_truncated: parsed_srcset_urls.len()
                                    > MAX_SRCSET_CANDIDATES_PER_IMAGE,
                            });
                        }
                        if resolved.is_some() {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                src,
                                "image",
                                &base_host,
                                &config,
                            );
                        }
                        for candidate in parsed_srcset_urls
                            .iter()
                            .take(MAX_SRCSET_CANDIDATES_PER_IMAGE)
                        {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                candidate,
                                "image",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    for element in document.select(&script_src_selector) {
                        if let Some(src) = element.value().attr("src") {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                src,
                                "script",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    for element in document.select(&link_href_selector) {
                        let Some(href) = element.value().attr("href") else {
                            continue;
                        };
                        let rel = element.value().attr("rel").unwrap_or("");
                        let resource_type = if rel
                            .split_ascii_whitespace()
                            .any(|value| value.eq_ignore_ascii_case("stylesheet"))
                        {
                            "stylesheet"
                        } else {
                            "other"
                        };
                        add_resource_candidate(
                            &mut resource_candidates,
                            &final_url,
                            &current_base,
                            href,
                            resource_type,
                            &base_host,
                            &config,
                        );
                    }
                    for element in document.select(&media_src_selector) {
                        if let Some(src) = element.value().attr("src") {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                src,
                                "other",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    for frame in &frames {
                        if let Some(frame_url) = &frame.resolved_url {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                frame_url,
                                "other",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    if missing_alt_count > 0 {
                        issues.push(CrawledPageIssue {
                            severity: "Warning".into(),
                            message: format!(
                                "{} image(s) missing an alt attribute",
                                missing_alt_count
                            ),
                        });
                    }
                }

                let semantic_content_partial = semantic_content_is_partial(
                    body_truncated,
                    body_read_failed,
                    semantic_terms.len(),
                    semantic_excerpts.len(),
                    semantic_links.len(),
                );
                let semantic_content_provenance =
                    semantic_provenance_for_mode(&config.crawl_mode, &semantic_content_source);
                let issues_count = issues.len();
                let discovery_sources = discovery_sources_by_url
                    .remove(&current_url)
                    .unwrap_or_default();
                pages.push(CrawledPageSummary {
                    url: current_url,
                    final_url,
                    discovery_sources,
                    redirect_chain,
                    redirect_stop_reason: redirect_stopped_reason,
                    depth,
                    http_status: status,
                    response_time_ms: page_duration,
                    rendered_lcp_ms,
                    rendered_inp_ms,
                    rendered_cls,
                    request_error_kind: None,
                    title,
                    title_length,
                    meta_description,
                    meta_description_length,
                    canonical,
                    canonical_targets,
                    canonical_declaration_count,
                    canonical_relation: canonical_relation.to_string(),
                    canonical_robots_conflict,
                    client_redirects,
                    meta_robots,
                    x_robots_tag,
                    robots_decision,
                    indexability_verdict,
                    indexability_status,
                    content_type,
                    content_length,
                    content_encoding,
                    charset,
                    detected_charset,
                    cache_control,
                    body_truncated,
                    word_count,
                    text_ratio_percent,
                    reading_time_minutes,
                    sentence_count: content_metrics.sentence_count,
                    average_words_per_sentence: content_metrics.average_words_per_sentence,
                    average_characters_per_word: content_metrics.average_characters_per_word,
                    complexity_score: content_metrics.complexity_score,
                    complexity_label: content_metrics.complexity_label.clone(),
                    readability_ease_score: content_metrics.readability_ease_score,
                    readability_grade: content_metrics.readability_grade,
                    readability_method: content_metrics.readability_method.clone(),
                    readability_label: content_metrics.readability_label.clone(),
                    content_terms: content_metrics.content_terms.clone(),
                    focus_phrase,
                    content_hash,
                    content_simhash,
                    semantic_terms,
                    semantic_excerpts,
                    semantic_links,
                    semantic_content_source,
                    semantic_content_provenance,
                    semantic_content_partial,
                    schema_types,
                    schema_references,
                    schema_syntax_errors,
                    schema_validation_findings,
                    schema_validation_truncated,
                    html_validation_findings,
                    html_validation_truncated,
                    document_language,
                    hreflangs,
                    amp_url,
                    amp_target_http_status: None,
                    amp_target_checked_in_run: false,
                    amp_target_canonical_alignment: None,
                    h1_count,
                    heading_counts,
                    duplicate_headings,
                    pagination_next,
                    pagination_prev,
                    pagination_links,
                    pagination_declaration_count,
                    pagination_invalid_declaration_count,
                    pagination_canonical_alignment,
                    internal_link_count,
                    external_link_count,
                    links,
                    images,
                    frames,
                    frames_truncated,
                    favicons,
                    favicon_metadata,
                    favicon_resource_checks,
                    social_meta_tags,
                    custom_search_results,
                    issues_count,
                    issues,
                });
            }
            Err(e) => {
                if e.kind == "cancelled" {
                    break;
                }
                let error_kind = e.kind;
                issues.push(CrawledPageIssue {
                    severity: "Critical".into(),
                    message: format!(
                        "{} request failed: {}",
                        error_kind.to_ascii_uppercase(),
                        e.message
                    ),
                });
                let discovery_sources = discovery_sources_by_url
                    .remove(&current_url)
                    .unwrap_or_default();
                pages.push(CrawledPageSummary {
                    url: current_url.clone(),
                    final_url: current_url,
                    discovery_sources,
                    redirect_chain: Vec::new(),
                    redirect_stop_reason: None,
                    depth,
                    http_status: 0,
                    response_time_ms: page_duration,
                    rendered_lcp_ms: None,
                    rendered_inp_ms: None,
                    rendered_cls: None,
                    request_error_kind: Some(error_kind),
                    title: None,
                    title_length: None,
                    meta_description: None,
                    meta_description_length: None,
                    canonical: None,
                    canonical_targets: Vec::new(),
                    canonical_declaration_count: 0,
                    canonical_relation: "unavailable".into(),
                    canonical_robots_conflict: false,
                    client_redirects: Vec::new(),
                    meta_robots: None,
                    x_robots_tag: None,
                    robots_decision: None,
                    indexability_verdict: Some(CrawledIndexabilityVerdict {
                        status: "uncertain".into(),
                        reasons: vec!["request_failed".into()],
                    }),
                    indexability_status: "Unavailable: request failed".into(),
                    content_type: None,
                    content_length: None,
                    content_encoding: None,
                    charset: None,
                    detected_charset: None,
                    cache_control: None,
                    body_truncated: false,
                    word_count: 0,
                    text_ratio_percent: None,
                    reading_time_minutes: None,
                    sentence_count: None,
                    average_words_per_sentence: None,
                    average_characters_per_word: None,
                    complexity_score: None,
                    complexity_label: None,
                    readability_ease_score: None,
                    readability_grade: None,
                    readability_method: None,
                    readability_label: None,
                    content_terms: Vec::new(),
                    focus_phrase: None,
                    content_hash: None,
                    content_simhash: None,
                    semantic_terms: Vec::new(),
                    semantic_excerpts: Vec::new(),
                    semantic_links: Vec::new(),
                    semantic_content_source: default_semantic_content_source(),
                    semantic_content_provenance: default_semantic_content_provenance(),
                    semantic_content_partial: false,
                    schema_types: Vec::new(),
                    schema_references: Vec::new(),
                    schema_syntax_errors: 0,
                    schema_validation_findings: Vec::new(),
                    schema_validation_truncated: false,
                    html_validation_findings: Vec::new(),
                    html_validation_truncated: false,
                    document_language: None,
                    hreflangs: Vec::new(),
                    amp_url: None,
                    amp_target_http_status: None,
                    amp_target_checked_in_run: false,
                    amp_target_canonical_alignment: None,
                    h1_count: 0,
                    heading_counts: vec![0; 6],
                    duplicate_headings: Vec::new(),
                    pagination_next: None,
                    pagination_prev: None,
                    pagination_links: Vec::new(),
                    pagination_declaration_count: 0,
                    pagination_invalid_declaration_count: 0,
                    pagination_canonical_alignment: None,
                    internal_link_count: 0,
                    external_link_count: 0,
                    links: Vec::new(),
                    images: Vec::new(),
                    frames: Vec::new(),
                    frames_truncated: false,
                    favicons: Vec::new(),
                    favicon_metadata: Vec::new(),
                    favicon_resource_checks: Vec::new(),
                    social_meta_tags: Vec::new(),
                    custom_search_results: Vec::new(),
                    issues_count: 1,
                    issues,
                });
            }
        }
        if html_parallelism > 1
            && !timed_out
            && !control.is_cancelled(&run_id)
            && !crawl_deadline_reached(start_time, max_run_seconds)
        {
            prefetch_http_pages(
                &mut queue,
                &mut prefetched_order,
                &mut prefetched_responses,
                html_parallelism,
                limit,
                pages.len(),
                &client,
                &base_host,
                config.allow_subdomains,
                config.scope_path.as_deref(),
                &config.allowed_hosts,
                max_redirects,
                &config,
                &robots_rules,
            )
            .await;
        }
    }

    annotate_page_relations(&mut pages, &config.crawl_mode);
    annotate_duplicates(&mut pages);

    let max_resource_requests = config.max_resource_requests.unwrap_or(250).clamp(1, 1_000);
    let mut ordered_resources = resource_candidates.into_values().collect::<Vec<_>>();
    ordered_resources.sort_by(|left, right| left.url.cmp(&right.url));
    let resource_limit_reached = ordered_resources.len() > max_resource_requests;
    let selected_resources = ordered_resources
        .into_iter()
        .take(max_resource_requests)
        .collect::<Vec<_>>();
    let mut resources = Vec::new();
    // A robots Crawl-delay is a site policy, so retain the strict sequential
    // request cadence whenever it is configured. Without that policy, optional
    // resource requests may use a bounded JoinSet, while page crawling itself
    // remains deterministic and sequential.
    if robots_crawl_delay.is_some() {
        for candidate in selected_resources {
            if crawl_deadline_reached(start_time, max_run_seconds) {
                timed_out = true;
                break;
            }
            if !control.wait_until_resumed(&run_id).await {
                break;
            }
            if let (Some(delay), Some(last_request_at)) = (robots_crawl_delay, last_page_request_at)
            {
                if !wait_for_crawl_delay(control, &run_id, last_request_at, delay).await {
                    break;
                }
            }
            last_page_request_at = Some(Instant::now());
            resources.push(fetch_resource_candidate(client.clone(), candidate).await);
        }
    } else {
        let max_concurrent_requests = config.max_concurrent_requests.unwrap_or(4).clamp(1, 16);
        let mut pending = selected_resources.into_iter();
        let mut tasks = JoinSet::new();
        for _ in 0..max_concurrent_requests {
            if let Some(candidate) = pending.next() {
                tasks.spawn(fetch_resource_candidate(client.clone(), candidate));
            }
        }
        while let Some(joined) = tasks.join_next().await {
            if crawl_deadline_reached(start_time, max_run_seconds) {
                timed_out = true;
                tasks.abort_all();
                break;
            }
            if !control.wait_until_resumed(&run_id).await {
                tasks.abort_all();
                break;
            }
            match joined {
                Ok(resource) => resources.push(resource),
                Err(_) => resources.push(CrawledResource {
                    source_urls: Vec::new(),
                    url: String::new(),
                    resource_type: "other".into(),
                    http_status: None,
                    content_type: None,
                    content_length: None,
                    intrinsic_width: None,
                    intrinsic_height: None,
                    dimensions_source: None,
                    response_time_ms: None,
                    request_error_kind: Some("resource_task".into()),
                }),
            }
            if let Some(candidate) = pending.next() {
                tasks.spawn(fetch_resource_candidate(client.clone(), candidate));
            }
        }
    }
    resources.retain(|resource| !resource.url.is_empty());
    resources.sort_by(|left, right| left.url.cmp(&right.url));

    // Link image rows to the result of an optional resource crawl. Do not
    // synthesize status or byte counts for images that were not requested or
    // fell outside the resource crawl's scope/limit.
    for page in &mut pages {
        apply_checked_image_resources(&mut page.images, &resources, &config);
    }
    apply_checked_social_resources(&mut pages, &resources, &config);
    apply_checked_frame_resources(&mut pages, &resources, &config);

    let CrawlScore {
        critical_count,
        warning_count,
        notice_count,
        health_score,
    } = score_pages(&pages);

    let cancelled = control.is_cancelled(&run_id);
    let _ = app.emit(
        "crawl-progress",
        CrawlProgress {
            run_id: run_id.clone(),
            current_url: None,
            discovered: visited.len(),
            completed: pages.len(),
            queued: queue.len() + prefetched_order.len(),
            cancelled,
            paused: false,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            pages_per_second: {
                let elapsed_seconds = start_time.elapsed().as_secs_f64();
                if elapsed_seconds > 0.0 {
                    pages.len() as f64 / elapsed_seconds
                } else {
                    0.0
                }
            },
        },
    );
    let limit_reasons = {
        let mut reasons = Vec::new();
        if pages.len() >= limit && (!queue.is_empty() || !prefetched_order.is_empty()) {
            reasons.push("max_pages".into());
        }
        if depth_limit_reached {
            reasons.push("max_depth".into());
        }
        if pages.iter().any(|page| page.body_truncated) {
            reasons.push("max_response_bytes".into());
        }
        if timed_out {
            reasons.push("max_run_seconds".into());
        }
        if pages.iter().any(|page| {
            page.issues
                .iter()
                .any(|issue| issue.message.contains("Redirect limit"))
        }) {
            reasons.push("max_redirects".into());
        }
        if resource_limit_reached {
            reasons.push("max_resource_requests".into());
        }
        reasons
    };
    let result = SiteCrawlResult {
        start_url: normalized_start_url.to_string(),
        crawl_mode: config.crawl_mode.clone(),
        pages_crawled: pages.len(),
        health_score,
        critical_count,
        warning_count,
        notice_count,
        pages,
        duration_ms: start_time.elapsed().as_millis() as u64,
        cancelled,
        timed_out,
        robots_txt_status,
        robots_user_agent: ua,
        robots_applicable_rules,
        robots_agent_matrix,
        robots_sitemap_directives,
        robots_blocked_count,
        sitemap_status,
        sitemap_urls_discovered: sitemap_urls.len(),
        sitemap_urls,
        rejected_urls,
        resources,
        resource_limit_reached,
        discovery_provenance_truncated,
        limit_reasons,
    };
    control.finish(&run_id);
    if let Some(session) = rendered_session {
        session.close();
    }
    Ok(result)
}
