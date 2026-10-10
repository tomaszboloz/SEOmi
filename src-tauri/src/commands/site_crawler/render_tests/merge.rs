use super::*;

#[test]
fn browser_status_is_kept_when_the_browser_reports_one() {
    let rendered = page_data(404, true, false);
    let merged = merge_rendered_with_http(rendered, page_data(200, true, true));
    assert_eq!(merged.status, 200);
}

#[test]
fn rendered_page_takes_status_and_headers_from_the_http_response() {
    let mut rendered = page_data(0, true, false);
    rendered.body = b"<html>rendered</html>".to_vec();
    rendered.rendered_lcp_ms = Some(420);
    let mut http = page_data(200, true, true);
    http.body = b"<html>raw</html>".to_vec();
    http.content_type = Some("text/html; charset=utf-8".into());
    http.x_robots_tag = Some("noindex".into());
    http.cache_control = Some("max-age=60".into());
    http.content_length = Some(16);
    http.content_encoding = Some("br".into());
    http.http_refresh = Some("5; url=/next".into());

    let merged = merge_rendered_with_http(rendered, http);

    assert_eq!(merged.status, 200);
    assert_eq!(
        merged.content_type.as_deref(),
        Some("text/html; charset=utf-8")
    );
    assert_eq!(merged.body, b"<html>rendered</html>");
    assert_eq!(merged.rendered_lcp_ms, Some(420));
    assert_eq!(merged.x_robots_tag.as_deref(), Some("noindex"));
    assert_eq!(merged.cache_control.as_deref(), Some("max-age=60"));
    assert_eq!(merged.content_length, Some(16));
    assert_eq!(merged.content_encoding.as_deref(), Some("br"));
    assert_eq!(merged.http_refresh.as_deref(), Some("5; url=/next"));
    assert!(merged.response_headers_available);
}

#[test]
fn transfer_charset_and_media_classification_stay_authoritative() {
    let mut rendered = page_data(0, false, false);
    rendered.charset = Some("windows-1252".into());
    rendered.content_type = Some("text/plain".into());
    let mut http = page_data(200, true, true);
    http.charset = Some("utf-8".into());
    http.content_type = Some("text/html; charset=utf-8".into());

    let merged = merge_rendered_with_http(rendered, http);

    assert_eq!(merged.charset.as_deref(), Some("utf-8"));
    assert_eq!(
        merged.content_type.as_deref(),
        Some("text/html; charset=utf-8")
    );
    assert!(merged.declared_html);
}

#[test]
fn browser_content_type_is_kept_when_the_response_declared_none() {
    let rendered = page_data(0, true, false);
    let mut http = page_data(200, true, true);
    http.content_type = None;
    let merged = merge_rendered_with_http(rendered, http);
    assert_eq!(merged.content_type.as_deref(), Some("text/html"));
}

#[test]
fn browser_charset_is_kept_when_the_response_declared_none() {
    let mut rendered = page_data(0, true, false);
    rendered.charset = Some("ISO-8859-2".into());
    rendered.response_url_mismatch = true;
    let mut http = page_data(200, true, true);
    http.charset = None;
    http.http_response_url = Some("https://example.com/redirected".into());
    http.content_disposition = Some("inline".into());

    let merged = merge_rendered_with_http(rendered, http);
    assert_eq!(merged.charset.as_deref(), Some("ISO-8859-2"));
    assert_eq!(
        merged.http_response_url.as_deref(),
        Some("https://example.com/redirected")
    );
    assert!(!merged.response_url_mismatch);
    assert_eq!(merged.content_disposition.as_deref(), Some("inline"));
}
