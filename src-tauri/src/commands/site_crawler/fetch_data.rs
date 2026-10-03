use super::*;

pub(super) async fn read_fetched_page_data(
    source: FetchedPageBody,
    max_response_bytes: usize,
) -> FetchedPageData {
    match source {
        FetchedPageBody::Prefetched(data) => *data,
        FetchedPageBody::Http(mut response) => {
            let status = response.status().as_u16();
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
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
                .map(|value| value.to_ascii_lowercase().contains("text/html"))
                .unwrap_or(true);
            let mut body_truncated =
                content_length.is_some_and(|size| size > max_response_bytes as u64);
            let mut body_read_failed = false;
            let mut body = Vec::new();
            if !body_truncated {
                loop {
                    match response.chunk().await {
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
                rendered_diagnostics: None,
                browser_navigation_time_ms: None,
                rendered_lcp_ms: None,
                rendered_inp_ms: None,
                rendered_cls: None,
            }
        }
        FetchedPageBody::Rendered(snapshot) => {
            let mut body = snapshot.html.into_bytes();
            let body_truncated = snapshot.html_truncated || body.len() > max_response_bytes;
            body.truncate(max_response_bytes);
            let content_type = Some(snapshot.content_type);
            let declared_html = content_type
                .as_deref()
                .is_some_and(|value| value.to_ascii_lowercase().contains("html"));
            FetchedPageData {
                status: snapshot.http_status.unwrap_or(0),
                content_type,
                // A serialized DOM length is not the transferred response size.
                content_length: None,
                content_encoding: None,
                http_refresh: None,
                cache_control: None,
                charset: Some(snapshot.charset),
                x_robots_tag: None,
                declared_html,
                body_truncated,
                body_read_failed: false,
                body,
                rendered_diagnostics: Some((
                    snapshot.failed_resource_urls,
                    snapshot.console_errors,
                )),
                browser_navigation_time_ms: snapshot.navigation_time_ms,
                rendered_lcp_ms: snapshot.lcp_ms,
                rendered_inp_ms: snapshot.inp_ms,
                rendered_cls: snapshot.cls,
            }
        }
    }
}
