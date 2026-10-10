use super::*;

#[cfg(test)]
pub(super) async fn fetch_resource_candidate(
    client: reqwest::Client,
    candidate: ResourceCandidate,
) -> CrawledResource {
    fetch_resource_candidate_with_context(client, candidate, RetryContext::disabled()).await
}

pub(super) async fn fetch_resource_candidate_with_context(
    client: reqwest::Client,
    candidate: ResourceCandidate,
    context: RetryContext,
) -> CrawledResource {
    let request_started_at = Instant::now();
    let mut retry_available = true;
    match send_get_with_retry(&client, &candidate.url, &context, &mut retry_available).await {
        Ok(fetched) => {
            let mut response = fetched.response;
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
                    match read_response_chunk(&mut response, &context).await {
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
            request_error_kind: Some(error.kind()),
        },
    }
}

#[cfg(test)]
#[path = "resource_fetch_tests/mod.rs"]
mod tests;
