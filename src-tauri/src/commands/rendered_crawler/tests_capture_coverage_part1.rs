use super::*;

#[tokio::test]
async fn test_capture_scope_and_url_errors() {
    check_err(vec![], None, "invalid://url", "").await;
    check_err(
        vec![],
        None,
        "https://other.test/",
        "outside the configured crawl scope",
    )
    .await;
    check_err(
        vec![],
        Some("/blog"),
        "https://example.test/shop",
        "outside the configured crawl scope",
    )
    .await;
}

#[tokio::test]
async fn test_capture_channel_closed_before_completion() {
    let (app, mut session) = fixture(vec![CaptureEvent::PageReady(1)], None);
    assert_eq!(
        session.capture("https://example.test/").await.unwrap_err(),
        "Renderer capture channel closed before completion."
    );
    assert!(session
        .capture_artifact(RenderedArtifactKind::Screenshot)
        .await
        .is_err());
    assert!(session
        .capture_artifact(RenderedArtifactKind::Pdf)
        .await
        .is_err());
    drop(app);
}

#[tokio::test]
async fn test_capture_invalid_chunks_and_decoding() {
    check_err(
        vec![CaptureEvent::PageReady(10), chunk(10, 0, 0, "x")],
        None,
        "https://example.test/",
        "invalid capture chunk",
    )
    .await;
    check_err(
        vec![
            CaptureEvent::PageReady(10),
            chunk(10, 0, MAX_CAPTURE_CHUNKS + 1, "x"),
        ],
        None,
        "https://example.test/",
        "invalid capture chunk",
    )
    .await;
    let big = "X".repeat(MAX_CAPTURE_CHUNK_BYTES + 1);
    check_err(
        vec![CaptureEvent::PageReady(10), chunk(10, 0, 1, &big)],
        None,
        "https://example.test/",
        "invalid capture chunk",
    )
    .await;
    check_err(
        vec![
            CaptureEvent::PageReady(10),
            chunk(10, 0, 2, "a"),
            chunk(10, 1, 3, "b"),
        ],
        None,
        "https://example.test/",
        "disagree about the total count",
    )
    .await;

    check_err(
        vec![CaptureEvent::PageReady(5), chunk(5, 0, 1, "@@not-base64@@")],
        None,
        "https://example.test/",
        "not valid base64url",
    )
    .await;
    let not_json = URL_SAFE_NO_PAD.encode(b"not json");
    check_err(
        vec![CaptureEvent::PageReady(5), chunk(5, 0, 1, &not_json)],
        None,
        "https://example.test/",
        "invalid snapshot JSON",
    )
    .await;
}
