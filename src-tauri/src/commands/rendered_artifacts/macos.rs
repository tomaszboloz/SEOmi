#[cfg(target_os = "macos")]
use {
    super::super::rendered_crawler::RenderedArtifactKind,
    block2::RcBlock,
    objc2::MainThreadMarker,
    objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage},
    objc2_foundation::{NSData, NSDictionary, NSError},
    objc2_web_kit::{WKPDFConfiguration, WKSnapshotConfiguration, WKWebView},
    std::sync::{Arc, Mutex},
    std::time::Duration,
    tauri::WebviewWindow,
    tokio::sync::oneshot,
    tokio::time::timeout,
};

#[cfg(target_os = "macos")]
type ArtifactSender = Arc<Mutex<Option<oneshot::Sender<Result<Vec<u8>, String>>>>>;

#[cfg(target_os = "macos")]
pub(crate) async fn capture_macos(
    window: &WebviewWindow,
    kind: RenderedArtifactKind,
) -> Result<Vec<u8>, String> {
    let (sender, receiver) = oneshot::channel::<Result<Vec<u8>, String>>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    window
        .with_webview(move |webview| {
            let raw = webview.inner();
            let view: &WKWebView = unsafe { &*(raw.cast()) };
            let Some(marker) = MainThreadMarker::new() else {
                send_artifact_result(
                    &sender,
                    Err("WKWebView capture was not scheduled on the main thread.".into()),
                );
                return;
            };

            match kind {
                RenderedArtifactKind::Screenshot => {
                    let configuration = unsafe { WKSnapshotConfiguration::new(marker) };
                    let callback_sender = Arc::clone(&sender);
                    let handler = RcBlock::new(move |image: *mut NSImage, _error: *mut NSError| {
                        if image.is_null() {
                            send_artifact_result(
                                &callback_sender,
                                Err("WKWebView did not return a screenshot.".into()),
                            );
                            return;
                        }
                        let Some(tiff_data) = (unsafe { (&*image).TIFFRepresentation() }) else {
                            send_artifact_result(
                                &callback_sender,
                                Err("WKWebView returned an empty screenshot.".into()),
                            );
                            return;
                        };
                        let Some(bitmap) = NSBitmapImageRep::imageRepWithData(&tiff_data) else {
                            send_artifact_result(
                                &callback_sender,
                                Err("WKWebView returned an invalid screenshot.".into()),
                            );
                            return;
                        };
                        let properties = NSDictionary::new();
                        let Some(png_data) = (unsafe {
                            bitmap.representationUsingType_properties(
                                NSBitmapImageFileType::PNG,
                                &properties,
                            )
                        }) else {
                            send_artifact_result(
                                &callback_sender,
                                Err("Unable to encode the macOS screenshot as PNG.".into()),
                            );
                            return;
                        };
                        send_artifact_result(&callback_sender, Ok(ns_data_bytes(&png_data)));
                    });
                    unsafe {
                        view.takeSnapshotWithConfiguration_completionHandler(
                            Some(&configuration),
                            &handler,
                        );
                    }
                }
                RenderedArtifactKind::Pdf => {
                    let configuration = unsafe { WKPDFConfiguration::new(marker) };
                    let callback_sender = Arc::clone(&sender);
                    let handler = RcBlock::new(move |data: *mut NSData, _error: *mut NSError| {
                        if data.is_null() {
                            send_artifact_result(
                                &callback_sender,
                                Err("WKWebView did not return a PDF.".into()),
                            );
                            return;
                        }
                        send_artifact_result(
                            &callback_sender,
                            Ok(ns_data_bytes(unsafe { &*data })),
                        );
                    });
                    unsafe {
                        view.createPDFWithConfiguration_completionHandler(
                            Some(&configuration),
                            &handler,
                        );
                    }
                }
            }
        })
        .map_err(|error| format!("Unable to schedule native macOS capture: {error}"))?;

    timeout(Duration::from_secs(30), receiver)
        .await
        .map_err(|_| "macOS rendered artifact capture timed out after 30 seconds.".to_string())?
        .map_err(|_| "macOS rendered artifact capture channel closed.".to_string())?
}

#[cfg(target_os = "macos")]
fn send_artifact_result(sender: &ArtifactSender, result: Result<Vec<u8>, String>) {
    if let Ok(mut sender) = sender.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(result);
        }
    }
}

#[cfg(target_os = "macos")]
fn ns_data_bytes(data: &objc2_foundation::NSData) -> Vec<u8> {
    use std::ffi::c_void;
    use std::ptr::NonNull;

    let length = data.length();
    if length == 0 {
        return Vec::new();
    }
    let mut bytes = vec![0u8; length];
    unsafe {
        data.getBytes_length(
            NonNull::new(bytes.as_mut_ptr().cast::<c_void>()).expect("non-empty buffer"),
            length,
        );
    }
    bytes
}
