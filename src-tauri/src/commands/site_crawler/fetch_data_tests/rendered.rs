use super::*;

#[tokio::test]
async fn rendered_document_preserves_observations_without_inventing_transfer_headers() {
    let snapshot = snapshot();
    let bytes = snapshot.html.as_bytes().to_vec();
    let result = read_fetched_page_data(FetchedPageBody::Rendered(snapshot), bytes.len()).await;
    assert_eq!(result.status, 0);
    assert_eq!(result.body, bytes);
    assert_eq!(result.browser_navigation_time_ms, Some(0));
    assert_eq!(result.rendered_lcp_ms, Some(125));
    assert_eq!(result.rendered_inp_ms, Some(0));
    assert_eq!(result.rendered_cls, Some(0.0));
    assert_eq!(result.charset.as_deref(), Some("UTF-8"));
    assert!(result.content_length.is_none() && result.content_encoding.is_none());
    assert!(
        result.http_refresh.is_none()
            && result.cache_control.is_none()
            && result.x_robots_tag.is_none()
    );
    assert!(result.declared_html && !result.body_truncated && !result.body_read_failed);
    let (resources, console) = result.rendered_diagnostics.unwrap();
    assert_eq!(resources, vec!["https://example.test/missing.png"]);
    assert_eq!(console, vec!["Synthetic diagnostic"]);
}

#[tokio::test]
async fn rendered_body_respects_byte_limit_and_capture_truncation() {
    for capture_truncated in [true, false] {
        for limit in [0, 8, 100] {
            let mut snapshot = snapshot();
            let bytes = snapshot.html.as_bytes().to_vec();
            snapshot.html_truncated = capture_truncated;
            snapshot.http_status = Some(201);
            let result = read_fetched_page_data(FetchedPageBody::Rendered(snapshot), limit).await;
            assert_eq!(result.status, 201);
            assert_eq!(result.body, bytes[..bytes.len().min(limit)]);
            assert_eq!(
                result.body_truncated,
                capture_truncated || bytes.len() > limit
            );
            assert!(!result.body_read_failed);
        }
    }
}

#[tokio::test]
async fn rendered_content_type_uses_same_html_media_type_boundary_as_http() {
    for (content_type, expected) in [
        ("application/xhtml+xml", true),
        ("TEXT/HTML", true),
        ("application/not-html", false),
        ("text/plain;note=html", false),
    ] {
        let mut snapshot = snapshot();
        snapshot.content_type = content_type.into();
        let result = read_fetched_page_data(FetchedPageBody::Rendered(snapshot), 100).await;
        assert_eq!(result.declared_html, expected, "{content_type}");
    }
}

#[tokio::test]
async fn prefetched_payload_retains_read_time_limit_and_measurements() {
    let page = read_fetched_page_data(FetchedPageBody::Rendered(snapshot()), 100).await;
    let bytes = page.body.clone();
    let result = read_fetched_page_data(FetchedPageBody::Prefetched(Box::new(page)), 0).await;
    assert_eq!(result.body, bytes);
    assert_eq!(result.rendered_lcp_ms, Some(125));
    assert!(!result.body_truncated);
}
