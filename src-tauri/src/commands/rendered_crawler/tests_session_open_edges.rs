use super::{
    models::{CaptureEvent, RenderOptions},
    preview::{normalize_preview_value, open_rendered_element_preview},
    session::RenderedCrawlerSession,
    session_open::capture_event_for_navigation,
};
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;
use url::Url;

#[test]
fn navigation_callback_maps_only_nonce_bound_capture_events() {
    let nonce = "open-edge-nonce";
    let chunk_url = Url::parse(&format!("seomi-capture://{nonce}/4/0/1?data=payload")).unwrap();
    assert!(matches!(
        capture_event_for_navigation(&chunk_url, nonce),
        Some(CaptureEvent::Chunk(chunk)) if chunk.sequence == 4 && chunk.index == 0
    ));

    let error_url = Url::parse(&format!("seomi-capture://{nonce}/4/error")).unwrap();
    assert!(matches!(
        capture_event_for_navigation(&error_url, nonce),
        Some(CaptureEvent::TransferFailed(4))
    ));
    assert!(capture_event_for_navigation(&error_url, "other-nonce").is_none());
    assert!(
        capture_event_for_navigation(&Url::parse("https://example.test/").unwrap(), nonce)
            .is_none()
    );
}

#[tokio::test]
async fn session_open_with_user_agent_cookie_and_options() {
    let app = StorageApp::new(mock_builder());
    let options = RenderOptions {
        user_agent: Some("CustomAgent/1.0".into()),
        cookie: Some("auth=xyz".into()),
        allowed_hosts: vec!["cdn.example.test".into()],
        ..Default::default()
    };
    let session = RenderedCrawlerSession::open(
        &app.handle(),
        "https://example.test/",
        "example.test",
        true,
        Some("/docs"),
        options,
    )
    .await
    .unwrap();
    assert!(session.allow_subdomains);
    assert_eq!(session.scope_path.as_deref(), Some("/docs"));
    assert_eq!(session.allowed_hosts, vec!["cdn.example.test"]);
    session.close();
}

#[tokio::test]
async fn session_open_and_preview_validation_edges() {
    let app = StorageApp::new(mock_builder());
    let res = RenderedCrawlerSession::open(
        &app.handle(),
        "://broken",
        "example.test",
        false,
        None,
        Default::default(),
    )
    .await;
    assert!(res.is_err());

    assert_eq!(
        normalize_preview_value("", "field", 10).unwrap_err(),
        "field cannot be empty."
    );
    assert_eq!(
        normalize_preview_value("toolong", "field", 3).unwrap_err(),
        "field exceeds the 3-character safety limit."
    );
    assert_eq!(
        normalize_preview_value("a\0b", "field", 10).unwrap_err(),
        "field contains an invalid null character."
    );

    let preview = open_rendered_element_preview(
        app.handle(),
        "https://example.test/".into(),
        "div.main".into(),
        Some("target".into()),
        Some(0),
        "Preview Window".into(),
        "Not Found".into(),
    )
    .await;
    assert!(preview.is_ok());
}
