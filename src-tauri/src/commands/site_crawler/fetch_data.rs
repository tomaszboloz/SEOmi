use super::*;

mod rendered;
use rendered::rendered_page_data;

pub(super) struct FetchedResponse {
    pub(super) response: FetchedPageBody,
    pub(super) final_url: String,
    pub(super) redirect_chain: Vec<CrawledRedirectHop>,
    pub(super) redirect_stopped_reason: Option<String>,
}

pub(super) enum FetchedPageBody {
    Http(reqwest::Response),
    Rendered(crate::commands::rendered_crawler::RenderedPageSnapshot),
    // Body already read inside the prefetch task. Holding an unread
    // `reqwest::Response` in the prefetch map lets the client's whole-request
    // timeout expire before the sequential loop reaches it.
    Prefetched(Box<FetchedPageData>),
}

pub(super) struct CrawlFetchFailure {
    pub(super) kind: String,
    pub(super) message: String,
}

pub(super) struct FetchedPageData {
    pub(super) status: u16,
    pub(super) content_type: Option<String>,
    pub(super) content_length: Option<u64>,
    pub(super) content_encoding: Option<String>,
    pub(super) http_refresh: Option<String>,
    pub(super) cache_control: Option<String>,
    pub(super) charset: Option<String>,
    pub(super) x_robots_tag: Option<String>,
    pub(super) declared_html: bool,
    pub(super) body_truncated: bool,
    pub(super) body_read_failed: bool,
    pub(super) body: Vec<u8>,
    pub(super) rendered_diagnostics: Option<(Vec<String>, Vec<String>)>,
    pub(super) browser_navigation_time_ms: Option<u64>,
    pub(super) rendered_lcp_ms: Option<u64>,
    pub(super) rendered_inp_ms: Option<u64>,
    pub(super) rendered_cls: Option<f64>,
}

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
        FetchedPageBody::Rendered(snapshot) => rendered_page_data(snapshot, max_response_bytes),
    }
}
