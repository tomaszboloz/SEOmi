use super::retry::{read_response_chunk, RetryContext};
use super::*;

#[path = "fetch_data_rendered.rs"]
mod rendered;

#[path = "fetch_data_media.rs"]
mod media;
pub(crate) use media::is_html_media_type;

#[cfg(test)]
#[path = "fetch_data_tests/mod.rs"]
mod tests;

pub(super) async fn read_fetched_page_data(
    source: FetchedPageBody,
    max_response_bytes: usize,
) -> FetchedPageData {
    read_fetched_page_data_with_context(source, max_response_bytes, None).await
}

pub(super) async fn read_fetched_page_data_with_context(
    source: FetchedPageBody,
    max_response_bytes: usize,
    context: Option<&RetryContext>,
) -> FetchedPageData {
    match source {
        FetchedPageBody::Prefetched(data) => *data,
        FetchedPageBody::Http(mut response) => {
            let status = response.status().as_u16();
            let http_response_url = Some(response.url().to_string());
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let content_disposition = response
                .headers()
                .get(reqwest::header::CONTENT_DISPOSITION)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let content_length = response.content_length();
            let content_encoding = response
                .headers()
                .get(reqwest::header::CONTENT_ENCODING)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let http_refresh = response
                .headers()
                .get("refresh")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned);
            let cache_control = response
                .headers()
                .get(reqwest::header::CACHE_CONTROL)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let charset = content_type.as_deref().and_then(|value| {
                value.split(';').find_map(|part| {
                    let (name, value) = part.trim().split_once('=')?;
                    name.trim()
                        .eq_ignore_ascii_case("charset")
                        .then(|| value.trim().to_string())
                })
            });
            let x_robots_tag = response
                .headers()
                .get("x-robots-tag")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned);
            let declared_html = content_type
                .as_deref()
                .map(is_html_media_type)
                .unwrap_or(true);
            let mut body_truncated = declared_html
                && content_length.is_some_and(|size| size > max_response_bytes as u64);
            let mut body_read_failed = false;
            let mut body = Vec::new();
            if declared_html && !body_truncated {
                loop {
                    let next_chunk = if let Some(context) = context {
                        read_response_chunk(&mut response, context)
                            .await
                            .map_err(|_| ())
                    } else {
                        response
                            .chunk()
                            .await
                            .map(|chunk| chunk.map(|value| value.to_vec()))
                            .map_err(|_| ())
                    };
                    match next_chunk {
                        Ok(Some(chunk)) => {
                            if body.len().saturating_add(chunk.len()) > max_response_bytes {
                                body_truncated = true;
                                break;
                            }
                            body.extend_from_slice(&chunk);
                        }
                        Ok(None) => break,
                        Err(_) => {
                            body_read_failed = true;
                            break;
                        }
                    }
                }
            }
            FetchedPageData {
                status,
                http_response_url,
                response_url_mismatch: false,
                content_type,
                content_disposition,
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
                rendered_diagnostics: None,
                browser_navigation_time_ms: None,
                rendered_lcp_ms: None,
                rendered_inp_ms: None,
                rendered_cls: None,
                response_headers_available: true,
                render_fallback: None,
            }
        }
        FetchedPageBody::Rendered(snapshot) => {
            rendered::read_rendered_page_data(snapshot, max_response_bytes)
        }
    }
}
