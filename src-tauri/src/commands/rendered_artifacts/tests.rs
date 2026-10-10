use super::{capture_window_artifact, native_webview_runtime, renderer_platform};
use crate::commands::rendered_crawler::RenderedArtifactKind;
use crate::utils::test_app::StorageApp;
use tauri::{test::mock_builder, WebviewWindowBuilder};

#[test]
fn renderer_platform_identifies_current_target() {
    let platform = renderer_platform();
    assert!(!platform.is_empty());
    #[cfg(target_os = "macos")]
    assert_eq!(platform, "macos-wkwebview");
    #[cfg(target_os = "windows")]
    assert_eq!(platform, "windows-webview2");
}

#[test]
fn native_webview_runtime_distinguishes_wry_and_mock() {
    assert!(native_webview_runtime::<tauri::Wry>());
    assert!(!native_webview_runtime::<tauri::test::MockRuntime>());
}

#[tokio::test]
async fn capture_window_artifact_rejects_mock_runtime_for_all_kinds() {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, "artifact-mock", Default::default())
        .build()
        .unwrap();

    let screenshot_err = capture_window_artifact(&window, RenderedArtifactKind::Screenshot)
        .await
        .unwrap_err();
    assert_eq!(
        screenshot_err,
        "Rendered artifact capture requires the native Wry runtime."
    );

    let pdf_err = capture_window_artifact(&window, RenderedArtifactKind::Pdf)
        .await
        .unwrap_err();
    assert_eq!(
        pdf_err,
        "Rendered artifact capture requires the native Wry runtime."
    );
}

#[cfg(target_os = "macos")]
#[test]
fn macos_ns_data_bytes_converts_empty_and_populated_buffers() {
    use super::macos::ns_data_bytes;
    use objc2_foundation::NSData;

    let empty = NSData::new();
    assert!(ns_data_bytes(&empty).is_empty());

    let payload = b"hello rendered media";
    let data = NSData::with_bytes(payload);
    assert_eq!(ns_data_bytes(&data), payload);
}

#[cfg(target_os = "macos")]
#[test]
fn macos_callback_results_preserve_native_failure_messages_and_bytes() {
    use super::macos::{pdf_result, screenshot_data_result, screenshot_result};
    use objc2_app_kit::NSImage;
    use objc2_foundation::NSData;

    assert_eq!(
        screenshot_result(None).unwrap_err(),
        "WKWebView did not return a screenshot."
    );
    let empty_image = NSImage::new();
    assert_eq!(
        screenshot_result(Some(&empty_image)).unwrap_err(),
        "WKWebView returned an empty screenshot."
    );
    let invalid_image = NSData::with_bytes(b"not a TIFF or PNG image");
    assert_eq!(
        screenshot_data_result(&invalid_image).unwrap_err(),
        "WKWebView returned an invalid screenshot."
    );

    assert_eq!(
        pdf_result(None).unwrap_err(),
        "WKWebView did not return a PDF."
    );
    let payload = b"native pdf bytes";
    let data = NSData::with_bytes(payload);
    assert_eq!(pdf_result(Some(&data)).unwrap(), payload);
}

#[cfg(target_os = "macos")]
#[tokio::test]
async fn macos_send_artifact_result_delivers_and_ignores_subsequent() {
    use super::macos::send_artifact_result;
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;

    let (sender, receiver) = oneshot::channel();
    let container = Arc::new(Mutex::new(Some(sender)));

    send_artifact_result(&container, Ok(vec![1, 2, 3]));
    let received = receiver.await.unwrap();
    assert_eq!(received.unwrap(), vec![1, 2, 3]);

    // Subsequent sends are safely ignored because the sender was consumed.
    send_artifact_result(&container, Err("late error".into()));

    // Sending into an already empty container does nothing.
    let empty_container = Arc::new(Mutex::new(None));
    send_artifact_result(&empty_container, Ok(vec![4]));

    let (sender, receiver) = oneshot::channel();
    let error_container = Arc::new(Mutex::new(Some(sender)));
    send_artifact_result(&error_container, Err("callback failed".into()));
    assert_eq!(receiver.await.unwrap().unwrap_err(), "callback failed");

    let (sender, mut receiver) = oneshot::channel();
    let poisoned = Arc::new(Mutex::new(Some(sender)));
    let panic_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe({
        let poisoned = Arc::clone(&poisoned);
        move || {
            let _guard = poisoned.lock().unwrap();
            panic!("poison callback sender mutex");
        }
    }));
    assert!(panic_result.is_err());
    send_artifact_result(&poisoned, Err("ignored after poisoned lock".into()));
    assert!(matches!(
        receiver.try_recv(),
        Err(tokio::sync::oneshot::error::TryRecvError::Empty)
    ));
    assert!(poisoned
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .is_some());

    let (sender, receiver) = oneshot::channel();
    drop(receiver);
    let dropped_receiver = Arc::new(Mutex::new(Some(sender)));
    send_artifact_result(&dropped_receiver, Err("receiver dropped".into()));
    assert!(dropped_receiver.lock().unwrap().is_none());
}
