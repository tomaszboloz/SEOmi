#[cfg(target_os = "macos")]
use super::macos::wait_for_artifact;
#[cfg(target_os = "macos")]
use std::time::Duration;
#[cfg(target_os = "macos")]
use tokio::sync::oneshot;

#[cfg(target_os = "macos")]
#[tokio::test]
async fn wait_for_artifact_handles_success_timeout_and_channel_closure() {
    let (tx, rx) = oneshot::channel();
    let _ = tx.send(Ok(vec![1, 2, 3]));
    let res = wait_for_artifact(rx, Duration::from_secs(1)).await;
    assert_eq!(res.unwrap(), vec![1, 2, 3]);

    let (_tx_hang, rx_hang) = oneshot::channel::<Result<Vec<u8>, String>>();
    let timeout_err = wait_for_artifact(rx_hang, Duration::from_millis(5))
        .await
        .unwrap_err();
    assert_eq!(
        timeout_err,
        "macOS rendered artifact capture timed out after 30 seconds."
    );

    let (tx_drop, rx_drop) = oneshot::channel::<Result<Vec<u8>, String>>();
    drop(tx_drop);
    let closed_err = wait_for_artifact(rx_drop, Duration::from_secs(1))
        .await
        .unwrap_err();
    assert_eq!(
        closed_err,
        "macOS rendered artifact capture channel closed."
    );

    let (tx_err, rx_err) = oneshot::channel::<Result<Vec<u8>, String>>();
    let _ = tx_err.send(Err("native capture error".into()));
    let delivered_err = wait_for_artifact(rx_err, Duration::from_secs(1))
        .await
        .unwrap_err();
    assert_eq!(delivered_err, "native capture error");
}

#[cfg(target_os = "macos")]
#[test]
fn artifact_conversions_and_sender_handle_edge_cases() {
    use super::macos::{
        ns_data_bytes, pdf_result, screenshot_data_result, screenshot_result, send_artifact_result,
    };
    use objc2_foundation::NSData;
    use std::sync::{Arc, Mutex};

    assert!(screenshot_result(None).is_err());
    assert!(pdf_result(None).is_err());

    let empty_data = NSData::new();
    assert_eq!(ns_data_bytes(&empty_data), Vec::<u8>::new());
    assert_eq!(pdf_result(Some(&empty_data)).unwrap(), Vec::<u8>::new());
    assert!(screenshot_data_result(&empty_data).is_err());

    let sender = Arc::new(Mutex::new(None));
    send_artifact_result(&sender, Ok(vec![1, 2, 3]));

    let (tx, mut rx) = oneshot::channel();
    let sender_active = Arc::new(Mutex::new(Some(tx)));
    send_artifact_result(&sender_active, Ok(vec![1, 2, 3]));
    assert_eq!(rx.try_recv().unwrap(), Ok(vec![1, 2, 3]));
}

#[cfg(target_os = "macos")]
#[tokio::test]
async fn capture_macos_fails_on_mock_runtime_windows() {
    use super::macos::capture_macos;
    use crate::commands::rendered_crawler::RenderedArtifactKind;
    use crate::utils::test_app::StorageApp;
    use tauri::{test::mock_builder, WebviewWindowBuilder};

    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, "macos-mock-art", Default::default())
        .build()
        .unwrap();

    let err_shot = capture_macos(&window, RenderedArtifactKind::Screenshot)
        .await
        .unwrap_err();
    assert!(
        err_shot == "macOS rendered artifact capture channel closed."
            || err_shot.starts_with("Unable to schedule native macOS capture:")
            || err_shot.contains("WKWebView capture was not scheduled on the main thread.")
            || err_shot.contains("timed out"),
        "got err_shot: {err_shot}"
    );

    let err_pdf = capture_macos(&window, RenderedArtifactKind::Pdf)
        .await
        .unwrap_err();
    assert!(
        err_pdf == "macOS rendered artifact capture channel closed."
            || err_pdf.starts_with("Unable to schedule native macOS capture:")
            || err_pdf.contains("WKWebView capture was not scheduled on the main thread.")
            || err_pdf.contains("timed out"),
        "got err_pdf: {err_pdf}"
    );
}

#[cfg(target_os = "macos")]
#[test]
fn screenshot_data_result_and_image_conversions_with_valid_data() {
    use super::macos::{screenshot_data_result, screenshot_result};
    use objc2::AnyThread;
    use objc2_app_kit::NSImage;
    use objc2_foundation::NSData;

    const MINIMAL_PNG: &[u8] = &[
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
        0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];
    let valid_data = NSData::with_bytes(MINIMAL_PNG);
    let png = screenshot_data_result(&valid_data).unwrap();
    assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));

    let image = NSImage::initWithData(NSImage::alloc(), &valid_data)
        .expect("valid PNG fixture must decode");
    let shot = screenshot_result(Some(&image)).unwrap();
    assert!(shot.starts_with(b"\x89PNG\r\n\x1a\n"));
}
