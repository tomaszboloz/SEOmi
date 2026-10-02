use super::*;

pub(super) fn rendered_page_data(
    snapshot: crate::commands::rendered_crawler::RenderedPageSnapshot,
    max_response_bytes: usize,
) -> FetchedPageData {
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
        rendered_diagnostics: Some((snapshot.failed_resource_urls, snapshot.console_errors)),
        browser_navigation_time_ms: snapshot.navigation_time_ms,
        rendered_lcp_ms: snapshot.lcp_ms,
        rendered_inp_ms: snapshot.inp_ms,
        rendered_cls: snapshot.cls,
    }
}
