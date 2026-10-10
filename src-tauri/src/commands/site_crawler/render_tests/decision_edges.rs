use super::*;

#[tokio::test]
async fn rendered_same_document_ignores_hash_and_preserves_headers() {
    let mut renderer = FakeRenderer::returning(vec![Ok(snapshot(
        "https://example.com/app#details",
        "<html><body><h1>Rendered With Fragment</h1></body></html>",
    ))]);
    let mut http = page_data(200, true, true);
    http.body = b"<html><body>raw</body></html>".to_vec();
    http.x_robots_tag = Some("index".into());

    let (data, final_url) = render_or_fallback(
        http,
        "https://example.com/app".into(),
        true,
        5_000_000,
        &mut renderer,
    )
    .await;

    assert_eq!(final_url, "https://example.com/app#details");
    assert!(!data.response_url_mismatch);
    assert!(data.response_headers_available);
    assert_eq!(data.x_robots_tag.as_deref(), Some("index"));
}

#[tokio::test]
async fn render_or_fallback_truncates_large_rendered_dom() {
    let mut renderer = FakeRenderer::returning(vec![Ok(snapshot(
        "https://example.com/doc",
        "1234567890abcdef",
    ))]);
    let http = page_data(200, true, true);

    let (data, _) = render_or_fallback(
        http,
        "https://example.com/doc".into(),
        true,
        8,
        &mut renderer,
    )
    .await;

    assert_eq!(data.body, b"12345678");
    assert!(data.body_truncated);
}

#[test]
fn is_attachment_and_same_http_document_edge_cases() {
    let mut http_attachment = page_data(200, true, true);
    http_attachment.content_disposition = Some("ATTACHMENT".into());
    assert!(!is_renderable_response(&http_attachment));

    let mut http_spaces = page_data(200, true, true);
    http_spaces.content_disposition = Some("   attachment ; filename=\"xyz.zip\"".into());
    assert!(!is_renderable_response(&http_spaces));

    let mut http_inline = page_data(200, true, true);
    http_inline.content_disposition = Some("inline; filename=page.html".into());
    assert!(is_renderable_response(&http_inline));

    assert!(super::same_http_document("not-a-url", "not-a-url"));
    assert!(!super::same_http_document(
        "not-a-url",
        "https://example.com/"
    ));
    assert!(!super::same_http_document(
        "https://example.com/",
        "not-a-url"
    ));
    assert!(super::same_http_document(
        "https://example.com/page?q=1#sec1",
        "https://example.com/page?q=1#sec2"
    ));
    assert!(!super::same_http_document(
        "https://example.com/page?q=1",
        "https://example.com/page?q=2"
    ));
}
