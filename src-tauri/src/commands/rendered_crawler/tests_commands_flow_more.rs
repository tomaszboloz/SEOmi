use super::commands::{artifact_with_session, finish_artifact, render_with_session};
use super::models::RenderedArtifactKind;
use super::tests_commands_flow::{ready_events, session, snapshot};

#[tokio::test]
async fn render_with_session_returns_the_snapshot_and_closes_the_window() {
    let (_app, session) = session(ready_events());
    let snapshot = render_with_session(session, "https://example.test/")
        .await
        .unwrap();
    assert_eq!(snapshot.final_url, "https://example.test/final");
}

#[tokio::test]
async fn artifact_with_session_surfaces_capture_and_native_artifact_failures() {
    let (_app, failing) = session(Vec::new());
    let error = artifact_with_session(
        failing,
        "https://example.test/",
        RenderedArtifactKind::Pdf,
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Renderer capture channel closed.");

    let (_app, mock) = session(ready_events());
    let error = artifact_with_session(
        mock,
        "https://example.test/",
        RenderedArtifactKind::Pdf,
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(
        error,
        "Rendered artifact capture requires the native Wry runtime."
    );
}

#[test]
fn finish_artifact_builds_a_bounded_named_artifact_or_forwards_errors() {
    let artifact = finish_artifact(
        Ok(snapshot()),
        Ok(b"%PDF".to_vec()),
        RenderedArtifactKind::Pdf,
        Some(format!("  {}  ", "r".repeat(200))),
    )
    .unwrap();
    assert_eq!(artifact.requested_url, "https://example.test/");
    assert_eq!(artifact.final_url, "https://example.test/final");
    assert_eq!(artifact.run_id.as_deref().map(str::len), Some(128));
    assert_eq!(artifact.artifact_type, "pdf");
    assert_eq!(artifact.content_type, "application/pdf");
    assert!(artifact.file_name.starts_with("rendered-page-"));
    assert!(artifact.file_name.ends_with("-pdf.pdf"));
    assert_eq!(artifact.bytes, 4);
    assert_eq!(artifact.data_base64, "JVBERg==");
    assert!(!artifact.captured_at.is_empty());
    assert!(!artifact.renderer_platform.is_empty());

    let blank = finish_artifact(
        Ok(snapshot()),
        Ok(Vec::new()),
        RenderedArtifactKind::Screenshot,
        Some("   ".into()),
    )
    .unwrap();
    assert_eq!(blank.run_id, None);
    assert_eq!(blank.content_type, "image/png");

    assert_eq!(
        finish_artifact(
            Err("capture".into()),
            Ok(Vec::new()),
            RenderedArtifactKind::Pdf,
            None
        )
        .unwrap_err(),
        "capture"
    );
    assert_eq!(
        finish_artifact(
            Ok(snapshot()),
            Err("bytes".into()),
            RenderedArtifactKind::Pdf,
            None
        )
        .unwrap_err(),
        "bytes"
    );
}
