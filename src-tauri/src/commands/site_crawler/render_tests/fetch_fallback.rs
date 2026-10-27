use super::*;

#[tokio::test]
async fn failed_render_keeps_the_http_page_and_a_failed_request_fails_the_page() {
    let origin = origin(vec![(
        "/slow",
        200,
        "Content-Type: text/html\r\n",
        "<p>raw</p>",
    )])
    .await;
    let mut renderer = FakeRenderer::returning(vec![Err("capture timed out".into())]);
    let fetched = origin.fetch("/slow", &mut renderer).await.ok().unwrap();
    let data = page(fetched).await;
    assert_eq!(data.body, b"<p>raw</p>");
    assert_eq!(data.render_fallback.as_deref(), Some("capture timed out"));

    let unreachable = Origin {
        client: reqwest::Client::builder().no_proxy().build().unwrap(),
        base: "ftp://example.test".into(),
    };
    let failure = unreachable.fetch("/file", &mut renderer).await;
    let failure = failure.err().unwrap();
    assert!(!failure.kind.is_empty() && !failure.message.is_empty());
    assert_eq!(renderer.rendered_urls.len(), 1);
}

#[tokio::test]
async fn disabled_rendering_uses_http_and_sets_fallback_message() {
    let origin = origin(vec![(
        "/disabled",
        200,
        "Content-Type: text/html\r\n",
        "<p>raw disabled</p>",
    )])
    .await;
    let mut renderer = FakeRenderer::returning(Vec::new());
    let config: CrawlConfig = serde_json::from_value(serde_json::json!({})).unwrap();
    let fetched = fetch_rendered_page(
        &origin.client,
        &format!("{}/disabled", origin.base),
        RenderRequestScope::new("example.test", 5),
        &config,
        false,
        &mut renderer,
        None,
    )
    .await
    .unwrap();
    let data = page(fetched).await;
    assert_eq!(data.body, b"<p>raw disabled</p>");
    assert!(data
        .render_fallback
        .as_deref()
        .unwrap()
        .contains("consecutive failures"));
    assert!(renderer.rendered_urls.is_empty());
}

#[tokio::test]
async fn max_response_bytes_clamped_and_enforced_in_rendered_fetch() {
    let origin = origin(vec![(
        "/large",
        200,
        "Content-Type: text/html\r\n",
        "<html>large content</html>",
    )])
    .await;
    let mut renderer = FakeRenderer::returning(vec![Ok(snapshot(
        &format!("{}/large", origin.base),
        "<html>rendered body with excessive length</html>",
    ))]);
    let mut config: CrawlConfig = serde_json::from_value(serde_json::json!({})).unwrap();
    config.max_response_bytes = Some(10);
    let fetched = fetch_rendered_page(
        &origin.client,
        &format!("{}/large", origin.base),
        RenderRequestScope::new("example.test", 5),
        &config,
        true,
        &mut renderer,
        None,
    )
    .await
    .unwrap();
    let data = page(fetched).await;
    assert_eq!(data.status, 200);
    assert!(data.rendered_diagnostics.is_some());
}
