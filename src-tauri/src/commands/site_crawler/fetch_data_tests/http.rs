use super::*;

#[tokio::test]
async fn http_body_preserves_headers_bytes_and_unknown_browser_metrics() {
    let bytes = "<p>Żółć</p>".as_bytes();
    let headers = format!("Content-Type: TEXT/HTML; ignored=x; CHARSET=\"utf-8\"\r\nContent-Length: {}\r\nContent-Encoding: identity\r\nCache-Control: max-age=60\r\nRefresh: 2;url=/next\r\nX-Robots-Tag: noindex\r\n", bytes.len());
    let result = read_fetched_page_data(
        FetchedPageBody::Http(response(&headers, bytes).await),
        bytes.len(),
    )
    .await;
    assert_eq!(result.status, 200);
    assert!(result
        .http_response_url
        .as_deref()
        .is_some_and(|url| url.starts_with("http://")));
    assert!(result.content_disposition.is_none());
    assert_eq!(result.body, bytes);
    assert_eq!(result.content_length, Some(bytes.len() as u64));
    assert_eq!(result.charset.as_deref(), Some("\"utf-8\""));
    assert_eq!(result.http_refresh.as_deref(), Some("2;url=/next"));
    assert_eq!(result.x_robots_tag.as_deref(), Some("noindex"));
    assert_eq!(result.cache_control.as_deref(), Some("max-age=60"));
    assert_eq!(result.content_encoding.as_deref(), Some("identity"));
    assert!(result.declared_html);
    assert!(!result.body_truncated && !result.body_read_failed);
    assert!(result.rendered_diagnostics.is_none() && result.browser_navigation_time_ms.is_none());
    assert!(
        result.rendered_lcp_ms.is_none()
            && result.rendered_inp_ms.is_none()
            && result.rendered_cls.is_none()
    );
}

#[tokio::test]
async fn http_content_disposition_is_retained_for_render_decision() {
    let result = read_fetched_page_data(
        FetchedPageBody::Http(response(
            "Content-Type: text/html\r\nContent-Disposition: attachment; filename=page.html\r\n",
            b"<html />",
        )
        .await),
        100,
    )
    .await;
    assert_eq!(
        result.content_disposition.as_deref(),
        Some("attachment; filename=page.html")
    );
}

#[tokio::test]
async fn http_size_limits_work_with_and_without_content_length() {
    for known_length in [true, false] {
        for limit in [0, 3, 4] {
            let headers = if known_length {
                "Content-Length: 4\r\n"
            } else {
                ""
            };
            let result = read_fetched_page_data(
                FetchedPageBody::Http(response(headers, b"body").await),
                limit,
            )
            .await;
            assert_eq!(result.body_truncated, limit < 4);
            assert!(!result.body_read_failed);
            assert!(result.body.len() <= limit);
            if limit == 4 {
                assert_eq!(result.body, b"body");
            }
            assert_eq!(result.content_length, known_length.then_some(4));
        }
    }
}

#[tokio::test]
async fn interrupted_http_body_is_failed_instead_of_complete() {
    let result = read_fetched_page_data(
        FetchedPageBody::Http(response("Content-Length: 100\r\n", b"part").await),
        100,
    )
    .await;
    assert!(result.body_read_failed);
    assert!(!result.body_truncated);
    assert_eq!(result.content_length, Some(100));
    assert!(result.body.len() < 100);
}

#[tokio::test]
async fn content_type_matches_media_type_not_parameter_or_substring() {
    for (media_type, expected) in [
        ("text/html", true),
        (" text/html ; charset=utf-8", true),
        ("application/xhtml+xml", true),
        ("application/json; note=text/html", false),
        ("application/not-html", false),
        ("text/html-fragment", false),
    ] {
        let header = format!("Content-Type: {media_type}\r\nRefresh: \r\nX-Robots-Tag: \r\n");
        let result =
            read_fetched_page_data(FetchedPageBody::Http(response(&header, b"").await), 10).await;
        assert_eq!(result.declared_html, expected, "{media_type}");
        assert!(result.http_refresh.is_none() && result.x_robots_tag.is_none());
    }
}

#[tokio::test]
async fn non_html_body_size_is_not_reported_as_html_limit() {
    let result = read_fetched_page_data(
        FetchedPageBody::Http(
            response(
                "Content-Type: image/png\r\nContent-Length: 100\r\n",
                b"binary",
            )
            .await,
        ),
        4,
    )
    .await;
    assert!(!result.declared_html);
    assert!(!result.body_truncated && !result.body_read_failed);
    assert!(result.body.is_empty());
}
