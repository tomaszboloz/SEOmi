use super::*;

pub(super) async fn fetch_resource_candidate(
    client: reqwest::Client,
    candidate: ResourceCandidate,
) -> CrawledResource {
    let request_started_at = Instant::now();
    match client.get(&candidate.url).send().await {
        Ok(mut response) => {
            let response_time_ms = request_started_at.elapsed().as_millis() as u64;
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let content_length = response.content_length();
            let mut body = Vec::new();
            let mut body_read_failed = false;
            if candidate.resource_type == "image"
                && response.status().is_success()
                && content_length.map_or(true, |length| length <= MAX_INTRINSIC_IMAGE_BYTES as u64)
            {
                loop {
                    match response.chunk().await {
                        Ok(Some(chunk)) => {
                            if body.len().saturating_add(chunk.len()) > MAX_INTRINSIC_IMAGE_BYTES {
                                body.clear();
                                break;
                            }
                            body.extend_from_slice(&chunk);
                        }
                        Ok(None) => break,
                        Err(_) => {
                            body.clear();
                            body_read_failed = true;
                            break;
                        }
                    }
                }
            }
            let dimensions = intrinsic_http_image_dimensions(content_type.as_deref(), &body);
            CrawledResource {
                source_urls: candidate.source_urls,
                url: candidate.url,
                resource_type: candidate.resource_type,
                http_status: Some(response.status().as_u16()),
                content_type,
                content_length,
                intrinsic_width: dimensions.map(|value| value.0),
                intrinsic_height: dimensions.map(|value| value.1),
                dimensions_source: dimensions.map(|_| "intrinsic-http".to_string()),
                response_time_ms: Some(response_time_ms),
                request_error_kind: body_read_failed.then(|| "resource_body_read".to_string()),
            }
        }
        Err(error) => CrawledResource {
            source_urls: candidate.source_urls,
            url: candidate.url,
            resource_type: candidate.resource_type,
            http_status: None,
            content_type: None,
            content_length: None,
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(request_started_at.elapsed().as_millis() as u64),
            request_error_kind: Some(request_error_kind(&error)),
        },
    }
}

pub(super) fn apply_checked_image_resources(
    images: &mut [CrawledImage],
    resources: &[CrawledResource],
    config: &CrawlConfig,
) {
    let checked_images = resources
        .iter()
        .filter(|resource| resource.resource_type == "image")
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();
    for image in images {
        let Ok(url) = url::Url::parse(&image.src) else {
            continue;
        };
        let key = normalize_crawl_url(url, config).to_string();
        if let Some(resource) = checked_images.get(key.as_str()) {
            image.checked_in_run = true;
            image.http_status = resource.http_status;
            image.content_length = resource.content_length;
            image.request_error_kind = resource.request_error_kind.clone();
            if let (Some(width), Some(height)) =
                (resource.intrinsic_width, resource.intrinsic_height)
            {
                let has_width = image.width.is_some();
                let has_height = image.height.is_some();
                if image.width.is_none() {
                    image.width = Some(width);
                }
                if image.height.is_none() {
                    image.height = Some(height);
                }
                if !has_width && !has_height {
                    image.dimensions_source = resource.dimensions_source.clone();
                } else if !has_width || !has_height {
                    image.dimensions_source = Some("mixed".to_string());
                }
            }
        }
        for candidate in &mut image.srcset_resource_checks {
            let Ok(url) = url::Url::parse(&candidate.url) else {
                continue;
            };
            let key = normalize_crawl_url(url, config).to_string();
            if let Some(resource) = checked_images.get(key.as_str()) {
                candidate.checked_in_run = true;
                candidate.http_status = resource.http_status;
                candidate.content_length = resource.content_length;
                candidate.request_error_kind = resource.request_error_kind.clone();
            }
        }
    }
}

pub(super) fn apply_checked_social_resource_checks(
    checks: &mut [CrawledSocialResourceCheck],
    checked_images: &HashMap<&str, &CrawledResource>,
    config: &CrawlConfig,
) {
    for check in checks {
        let Ok(url) = url::Url::parse(&check.url) else {
            continue;
        };
        let key = normalize_crawl_url(url, config).to_string();
        if let Some(resource) = checked_images.get(key.as_str()) {
            check.checked_in_run = true;
            check.http_status = resource.http_status;
            check.content_type = resource.content_type.clone();
            check.content_length = resource.content_length;
            check.intrinsic_width = resource.intrinsic_width;
            check.intrinsic_height = resource.intrinsic_height;
            check.dimensions_source = resource.dimensions_source.clone();
            check.request_error_kind = resource.request_error_kind.clone();
        }
    }
}

pub(super) fn apply_checked_social_resources(
    pages: &mut [CrawledPageSummary],
    resources: &[CrawledResource],
    config: &CrawlConfig,
) {
    let checked_images = resources
        .iter()
        .filter(|resource| resource.resource_type == "image")
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();
    for page in pages {
        apply_checked_social_resource_checks(
            &mut page.favicon_resource_checks,
            &checked_images,
            config,
        );
        for tag in &mut page.social_meta_tags {
            if let Some(check) = &mut tag.resource_check {
                apply_checked_social_resource_checks(
                    std::slice::from_mut(check),
                    &checked_images,
                    config,
                );
            }
        }
    }
}

pub(super) fn apply_checked_frame_resources(
    pages: &mut [CrawledPageSummary],
    resources: &[CrawledResource],
    config: &CrawlConfig,
) {
    let checked_resources = resources
        .iter()
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();
    for page in pages {
        for frame in &mut page.frames {
            let Some(resolved_url) = frame.resolved_url.as_deref() else {
                continue;
            };
            let Ok(url) = url::Url::parse(resolved_url) else {
                continue;
            };
            let key = normalize_crawl_url(url, config).to_string();
            if let Some(resource) = checked_resources.get(key.as_str()) {
                frame.checked_in_run = true;
                frame.http_status = resource.http_status;
                frame.request_error_kind = resource.request_error_kind.clone();
            }
        }
    }
}
