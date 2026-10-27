use super::*;

#[tokio::test]
async fn non_renderable_responses_are_used_as_is_without_calling_the_renderer() {
    let mut renderer = FakeRenderer::returning(Vec::new());
    for http in [page_data(404, true, true), page_data(200, false, true)] {
        let status = http.status;
        let (data, final_url) = render_or_fallback(
            http,
            "https://example.com/file".into(),
            true,
            5_000_000,
            &mut renderer,
        )
        .await;
        assert_eq!(data.status, status);
        assert!(data.render_fallback.is_none());
        assert!(data.rendered_diagnostics.is_none());
        assert_eq!(final_url, "https://example.com/file");
    }
    assert!(renderer.rendered_urls.is_empty());
}

#[tokio::test]
async fn rendered_dom_is_merged_with_the_http_response_and_follows_the_browser_url() {
    let mut renderer = FakeRenderer::returning(vec![Ok(snapshot(
        "https://example.com/app/home",
        "<html><body><h1>Rendered</h1></body></html>",
    ))]);
    let mut http = page_data(200, true, true);
    http.body = b"<html><body><div id=\"root\"></div></body></html>".to_vec();
    http.x_robots_tag = Some("noindex".into());

    let (data, final_url) = render_or_fallback(
        http,
        "https://example.com/app".into(),
        true,
        5_000_000,
        &mut renderer,
    )
    .await;

    assert_eq!(renderer.rendered_urls, vec!["https://example.com/app"]);
    assert_eq!(final_url, "https://example.com/app/home");
    assert_eq!(data.status, 200);
    assert_eq!(data.body, b"<html><body><h1>Rendered</h1></body></html>");
    assert_eq!(data.x_robots_tag.as_deref(), Some("noindex"));
    assert_eq!(data.rendered_lcp_ms, Some(300));
    assert!(data.rendered_diagnostics.is_some());
    assert!(!data.response_headers_available);
    assert!(data.response_url_mismatch);
    assert!(data.render_fallback.is_none());
}

#[tokio::test]
async fn failed_render_falls_back_to_the_raw_html_with_the_reason() {
    let mut renderer = FakeRenderer::returning(vec![Err(
        "Rendered page capture timed out after 60 seconds.".into(),
    )]);
    let mut http = page_data(200, true, true);
    http.body = b"<html>raw</html>".to_vec();

    let (data, final_url) = render_or_fallback(
        http,
        "https://example.com/slow".into(),
        true,
        5_000_000,
        &mut renderer,
    )
    .await;

    assert_eq!(data.body, b"<html>raw</html>");
    assert_eq!(
        data.render_fallback.as_deref(),
        Some("Rendered page capture timed out after 60 seconds.")
    );
    // Not rendered: the crawl loop must count this page as a fallback.
    assert!(data.rendered_diagnostics.is_none());
    assert_eq!(final_url, "https://example.com/slow");
}

#[tokio::test]
async fn switched_off_rendering_skips_the_renderer_and_records_why() {
    let mut renderer = FakeRenderer::returning(Vec::new());
    let (data, _) = render_or_fallback(
        page_data(200, true, true),
        "https://example.com/".into(),
        false,
        5_000_000,
        &mut renderer,
    )
    .await;

    assert!(renderer.rendered_urls.is_empty());
    assert!(data
        .render_fallback
        .as_deref()
        .is_some_and(|reason| reason.contains("switched off")));
}

#[test]
fn only_successful_html_responses_are_sent_to_the_renderer() {
    assert!(is_renderable_response(&page_data(200, true, true)));
    // A download such as a .zip never fires a page load in the browser.
    assert!(!is_renderable_response(&page_data(200, false, true)));
    assert!(!is_renderable_response(&page_data(404, true, true)));
    assert!(!is_renderable_response(&page_data(301, true, true)));
    assert!(is_renderable_response(&page_data(299, true, true)));
    assert!(!is_renderable_response(&page_data(300, true, true)));
    assert!(!is_renderable_response(&page_data(199, true, true)));
    let mut unread = page_data(200, true, true);
    unread.body_read_failed = true;
    assert!(!is_renderable_response(&unread));
    let mut attachment = page_data(200, true, true);
    attachment.content_disposition = Some("attachment; filename=page.html".into());
    assert!(!is_renderable_response(&attachment));
}
