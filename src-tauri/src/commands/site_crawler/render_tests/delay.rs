use super::*;
use crate::commands::site_crawler::control::CrawlControl;
use crate::commands::site_crawler::models::CrawlConfig;
use crate::commands::site_crawler::render_fetch::{fetch_rendered_page, RenderRequestScope};
use std::time::{Duration, Instant};

#[tokio::test]
async fn rendered_transport_waits_between_http_and_browser_requests() {
    let origin = super::fetch::origin(vec![(
        "/page",
        200,
        "Content-Type: text/html\r\n",
        "<p>rendered</p>",
    )])
    .await;
    let mut renderer = FakeRenderer::returning(vec![Ok(snapshot(
        &format!("{}/page", origin.base),
        "<p>rendered</p>",
    ))]);
    let config: CrawlConfig = serde_json::from_value(serde_json::json!({})).unwrap();
    let control = CrawlControl::new();
    let started = Instant::now();
    let delay = Duration::from_millis(30);
    let url = format!("{}/page", origin.base);
    let fetched = fetch_rendered_page(
        &origin.client,
        &url,
        RenderRequestScope::new("example.test", 5),
        &config,
        true,
        &mut renderer,
        Some((&control, "fixture-run", started, delay)),
    )
    .await
    .unwrap();
    assert!(started.elapsed() >= delay);
    assert_eq!(fetched.final_url, url);
    assert_eq!(renderer.rendered_urls.len(), 1);
}

#[tokio::test]
async fn rendered_transport_cancelled_during_crawl_delay() {
    let origin = super::fetch::origin(vec![(
        "/page",
        200,
        "Content-Type: text/html\r\n",
        "<p>rendered</p>",
    )])
    .await;
    let mut renderer = FakeRenderer::returning(Vec::new());
    let config: CrawlConfig = serde_json::from_value(serde_json::json!({})).unwrap();
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert("cancelled-run".into());
    let started = Instant::now();
    let delay = Duration::from_millis(100);
    let url = format!("{}/page", origin.base);
    let res = fetch_rendered_page(
        &origin.client,
        &url,
        RenderRequestScope::new("example.test", 5),
        &config,
        true,
        &mut renderer,
        Some((&control, "cancelled-run", started, delay)),
    )
    .await;
    let err = match res {
        Err(e) => e,
        Ok(_) => panic!("expected error"),
    };
    assert_eq!(err.kind, "cancelled");
    assert!(err
        .message
        .contains("cancelled during rendered crawl-delay pause"));
    assert!(renderer.rendered_urls.is_empty());
}

#[tokio::test]
async fn rendered_transport_skips_delay_gate_when_not_renderable_or_rendering_disabled() {
    let origin = super::fetch::origin(vec![
        ("/not-html", 200, "Content-Type: image/png\r\n", "PNG"),
        ("/error", 500, "Content-Type: text/html\r\n", "Error"),
    ])
    .await;
    let mut renderer = FakeRenderer::returning(Vec::new());
    let config: CrawlConfig = serde_json::from_value(serde_json::json!({})).unwrap();
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert("run-id".into());
    let started = Instant::now();
    let delay = Duration::from_millis(500);

    let fetched = fetch_rendered_page(
        &origin.client,
        &format!("{}/not-html", origin.base),
        RenderRequestScope::new("example.test", 5),
        &config,
        true,
        &mut renderer,
        Some((&control, "run-id", started, delay)),
    )
    .await
    .unwrap();
    assert_eq!(fetched.final_url, format!("{}/not-html", origin.base));

    let fetched = fetch_rendered_page(
        &origin.client,
        &format!("{}/error", origin.base),
        RenderRequestScope::new("example.test", 5),
        &config,
        false,
        &mut renderer,
        Some((&control, "run-id", started, delay)),
    )
    .await
    .unwrap();
    assert_eq!(fetched.final_url, format!("{}/error", origin.base));
}
