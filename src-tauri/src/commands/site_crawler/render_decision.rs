use super::fetch_data::read_fetched_page_data;
use super::fetch_types::{FetchedPageBody, FetchedPageData};
use super::render_health::MAX_CONSECUTIVE_RENDER_FAILURES;
use crate::commands::rendered_crawler::RenderedPageSnapshot;

#[cfg(test)]
#[path = "render_tests/mod.rs"]
mod tests;

/// The browser side of rendered mode, behind a trait so that the decision
/// logic can be exercised without a real webview.
pub(crate) trait PageRenderer {
    fn render(
        &mut self,
        url: &str,
    ) -> impl std::future::Future<Output = Result<RenderedPageSnapshot, String>> + Send;
}

/// Only a successful HTML document is worth a renderer window.
pub(crate) fn is_renderable_response(http: &FetchedPageData) -> bool {
    http.declared_html
        && (200..300).contains(&http.status)
        && !http.body_read_failed
        && !is_attachment(http.content_disposition.as_deref())
}

fn is_attachment(content_disposition: Option<&str>) -> bool {
    content_disposition
        .and_then(|value| value.split(';').next())
        .is_some_and(|disposition| disposition.trim().eq_ignore_ascii_case("attachment"))
}

/// Keep the rendered DOM and lab metrics, and take everything the browser
/// cannot report from the HTTP response of the same URL.
pub(crate) fn merge_rendered_with_http(
    mut rendered: FetchedPageData,
    http: FetchedPageData,
) -> FetchedPageData {
    rendered.status = http.status;
    rendered.http_response_url = http.http_response_url.clone();
    rendered.response_url_mismatch = false;
    // `document.contentType` drops the charset parameter of the real header.
    if http.content_type.is_some() {
        rendered.content_type = http.content_type;
    }
    // The HTTP response is authoritative for the transfer charset and media
    // classification. The browser may expose a different document charset or
    // content type after it has parsed the DOM.
    if http.charset.is_some() {
        rendered.charset = http.charset;
    }
    rendered.declared_html = http.declared_html;
    rendered.content_disposition = http.content_disposition;
    rendered.content_length = http.content_length;
    rendered.content_encoding = http.content_encoding;
    rendered.http_refresh = http.http_refresh;
    rendered.cache_control = http.cache_control;
    rendered.x_robots_tag = http.x_robots_tag;
    rendered.response_headers_available = http.response_headers_available;
    rendered
}

/// Decide what a rendered-mode page is analyzed from: the HTTP response as
/// it is (not renderable), the rendered DOM merged with the HTTP response, or
/// the raw HTML with a recorded reason when rendering is off or failed.
pub(crate) async fn render_or_fallback<R: PageRenderer>(
    mut http: FetchedPageData,
    final_url: String,
    rendering_enabled: bool,
    max_response_bytes: usize,
    renderer: &mut R,
) -> (FetchedPageData, String) {
    if !is_renderable_response(&http) {
        return (http, final_url);
    }
    if !rendering_enabled {
        http.render_fallback = Some(format!(
            "rendering was switched off after {MAX_CONSECUTIVE_RENDER_FAILURES} consecutive failures"
        ));
        return (http, final_url);
    }
    match renderer.render(&final_url).await {
        Ok(snapshot) => {
            let rendered_final_url = snapshot.final_url.clone();
            let rendered =
                read_fetched_page_data(FetchedPageBody::Rendered(snapshot), max_response_bytes)
                    .await;
            let mut merged = merge_rendered_with_http(rendered, http);
            merged.response_url_mismatch = !same_http_document(&final_url, &rendered_final_url);
            if merged.response_url_mismatch {
                // Keep the observed HTTP headers as evidence, but do not use
                // them as directives for a different rendered document.
                merged.response_headers_available = false;
            }
            (merged, rendered_final_url)
        }
        Err(message) => {
            http.render_fallback = Some(message);
            (http, final_url)
        }
    }
}

fn same_http_document(left: &str, right: &str) -> bool {
    let Ok(mut left) = url::Url::parse(left) else {
        return left == right;
    };
    let Ok(mut right) = url::Url::parse(right) else {
        return left.as_str() == right;
    };
    left.set_fragment(None);
    right.set_fragment(None);
    left == right
}
