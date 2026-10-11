use super::*;

#[tokio::test]
async fn test_session_open_options_and_failure_paths() {
    let app = StorageApp::new(mock_builder());
    let session = RenderedCrawlerSession::open(
        &app.handle(),
        "https://example.test/start",
        "example.test",
        false,
        None,
        RenderOptions::default(),
    )
    .await
    .unwrap();
    assert!(!session.allow_subdomains);
    session.close();

    assert!(RenderedCrawlerSession::open(
        &app.handle(),
        "ftp://invalid.test",
        "example.test",
        false,
        None,
        RenderOptions::default(),
    )
    .await
    .is_err());
}
