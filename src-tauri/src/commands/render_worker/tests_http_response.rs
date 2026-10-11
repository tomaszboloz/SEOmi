use super::{
    http_response::{format_render_snapshot, health_response, json_error, write_response},
    models::WorkerShared,
};
use crate::{commands::rendered_crawler::RenderedPageSnapshot, utils::test_app::StorageApp};
use std::{sync::Arc, time::Duration};
use tauri::test::mock_builder;
use tokio::{sync::Mutex, time::Instant};

#[test]
fn test_json_error_serialization() {
    let message = "custom worker error";
    let bytes = json_error(message);
    let val: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(val["error"], message);

    let empty = json_error("");
    let empty_val: serde_json::Value = serde_json::from_slice(&empty).unwrap();
    assert_eq!(empty_val["error"], "");
}

#[test]
fn test_health_response_active_and_expired() {
    let app = StorageApp::new(mock_builder());
    let active_shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("active-tok".into()))),
        expires_at: Instant::now() + Duration::from_secs(300),
        expires_at_text: "2026-10-10T22:00:00Z".into(),
    };
    let (status, content_type, body) = health_response(&active_shared).unwrap();
    assert_eq!(status, 200);
    assert_eq!(content_type, "application/json");
    let val: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(val["ok"], true);
    assert_eq!(val["version"], super::models::RENDER_WORKER_VERSION);
    assert_eq!(
        val["renderer"],
        crate::commands::rendered_artifacts::renderer_platform()
    );
    assert_eq!(val["expiresAt"], "2026-10-10T22:00:00Z");
    assert!(val["expiresInSeconds"].as_u64().unwrap() > 0);

    let expired_shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("expired-tok".into()))),
        expires_at: Instant::now() - Duration::from_millis(50),
        expires_at_text: "2026-10-10T21:55:00Z".into(),
    };
    let (status, content_type, body) = health_response(&expired_shared).unwrap();
    assert_eq!(status, 410);
    assert_eq!(content_type, "application/json");
    let exp_val: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(exp_val["ok"], false);
    assert_eq!(exp_val["expiresInSeconds"], 0);
}

#[test]
fn test_format_render_snapshot_under_and_over_limit() {
    let snapshot = RenderedPageSnapshot {
        requested_url: "https://example.test/".into(),
        final_url: "https://example.test/".into(),
        http_status: Some(200),
        content_type: "text/html".into(),
        charset: "utf-8".into(),
        html: "<html><body><h1>Hello</h1></body></html>".into(),
        html_truncated: false,
        navigation_time_ms: Some(15),
        lcp_ms: Some(30),
        inp_ms: None,
        cls: Some(0.01),
        failed_resource_urls: vec![],
        console_errors: vec![],
    };

    let (status, content_type, body) = format_render_snapshot(&snapshot).unwrap();
    assert_eq!(status, 200);
    assert_eq!(content_type, "application/json");
    let decoded: RenderedPageSnapshot = serde_json::from_slice(&body).unwrap();
    assert_eq!(decoded.requested_url, snapshot.requested_url);
    assert_eq!(decoded.html, snapshot.html);

    let mut large_snapshot = snapshot;
    large_snapshot.html = "X".repeat(8 * 1024 * 1024 + 1024);
    let (status, content_type, body) = format_render_snapshot(&large_snapshot).unwrap();
    assert_eq!(status, 413);
    assert_eq!(content_type, "application/json");
    let val: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(
        val["error"],
        "Rendered snapshot exceeds the response safety limit."
    );
}

#[tokio::test]
async fn test_write_response_status_codes() {
    use tokio::io::AsyncReadExt;
    for (status, expected_reason) in [
        (200, "200 OK"),
        (400, "400 Bad Request"),
        (401, "401 Unauthorized"),
        (404, "404 Not Found"),
        (410, "410 Gone"),
        (413, "413 Payload Too Large"),
        (415, "415 Unsupported Media Type"),
        (422, "422 Unprocessable Entity"),
        (426, "426 Upgrade Required"),
        (503, "503 Error"),
    ] {
        let (mut client, mut server) = tokio::io::duplex(1024);
        write_response(&mut server, status, "text/plain", b"hi")
            .await
            .unwrap();
        let mut buf = String::new();
        client.read_to_string(&mut buf).await.unwrap();
        assert!(buf.contains(expected_reason));
        assert!(buf.contains("Content-Length: 2"));
    }
}
