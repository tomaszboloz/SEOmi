use std::time::Duration;

use tauri::WebviewWindow;
use tokio::sync::oneshot;
use tokio::time::timeout;

use super::rendered_crawler::RenderedArtifactKind;

#[cfg(target_os = "macos")]
type ArtifactSender =
    std::sync::Arc<std::sync::Mutex<Option<oneshot::Sender<Result<Vec<u8>, String>>>>>;

#[cfg(target_os = "windows")]
type WindowsArtifactSender =
    std::sync::Arc<std::sync::Mutex<Option<oneshot::Sender<Result<Vec<u8>, String>>>>>;

pub(crate) async fn capture_window_artifact(
    window: &WebviewWindow,
    kind: RenderedArtifactKind,
) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        return capture_macos(window, kind).await;
    }

    #[cfg(target_os = "windows")]
    {
        return capture_windows(window, kind).await;
    }

    #[allow(unreachable_code)]
    Err("Rendered screenshots and PDFs require the macOS or Windows desktop renderer.".into())
}

pub(crate) fn renderer_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        return "macos-wkwebview";
    }
    #[cfg(target_os = "windows")]
    {
        return "windows-webview2";
    }
    #[allow(unreachable_code)]
    "unsupported-platform"
}

#[cfg(target_os = "macos")]
async fn capture_macos(
    window: &WebviewWindow,
    kind: RenderedArtifactKind,
) -> Result<Vec<u8>, String> {
    use block2::RcBlock;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSData, NSDictionary, NSError};
    use objc2_web_kit::{WKPDFConfiguration, WKSnapshotConfiguration, WKWebView};
    use std::sync::{Arc, Mutex};

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

#[cfg(target_os = "windows")]
async fn capture_windows(
    window: &WebviewWindow,
    kind: RenderedArtifactKind,
) -> Result<Vec<u8>, String> {
    use std::fs;

    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_7, COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
    };
    use webview2_com::{CapturePreviewCompletedHandler, PrintToPdfCompletedHandler};
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;
    use windows::Win32::System::Com::IStream;

    let (sender, receiver) = oneshot::channel::<Result<Vec<u8>, String>>();
    let sender: WindowsArtifactSender = std::sync::Arc::new(std::sync::Mutex::new(Some(sender)));
    let pdf_path = std::env::temp_dir().join(format!(
        "seomi-rendered-{}.pdf",
        uuid::Uuid::new_v4().simple()
    ));
    let pdf_path_for_callback = pdf_path.clone();

    window
        .with_webview(move |webview| {
            let controller = webview.controller();
            let core = match unsafe { controller.CoreWebView2() } {
                Ok(core) => core,
                Err(error) => {
                    send_windows_artifact_result(
                        &sender,
                        Err(format!("Unable to access WebView2: {error}")),
                    );
                    return;
                }
            };

            match kind {
                RenderedArtifactKind::Screenshot => {
                    let callback_sender = std::sync::Arc::clone(&sender);
                    let stream: IStream = match unsafe {
                        CreateStreamOnHGlobal(HGLOBAL(std::ptr::null_mut()), true)
                    } {
                        Ok(stream) => stream,
                        Err(error) => {
                            send_windows_artifact_result(
                                &sender,
                                Err(format!("Unable to allocate screenshot stream: {error}")),
                            );
                            return;
                        }
                    };
                    let stream_for_callback = stream.clone();
                    let handler = CapturePreviewCompletedHandler::create(Box::new(move |status| {
                        if let Err(error) = status {
                            send_windows_artifact_result(
                                &callback_sender,
                                Err(format!("WebView2 screenshot failed: {error}")),
                            );
                            return Ok(());
                        }
                        let result = read_com_stream(&stream_for_callback);
                        send_windows_artifact_result(&callback_sender, result);
                        Ok(())
                    }));
                    if let Err(error) = unsafe {
                        core.CapturePreview(
                            COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
                            &stream,
                            &handler,
                        )
                    } {
                        send_windows_artifact_result(
                            &sender,
                            Err(format!("Unable to start WebView2 screenshot: {error}")),
                        );
                    }
                }
                RenderedArtifactKind::Pdf => {
                    let callback_sender = std::sync::Arc::clone(&sender);
                    let path_string = pdf_path_for_callback.to_string_lossy().into_owned();
                    let path_wide: Vec<u16> = path_string.encode_utf16().chain([0]).collect();
                    let path_pointer = PCWSTR(path_wide.as_ptr());
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |status, success| {
                        let result = if status.is_err() || !success {
                            Err("WebView2 PDF export reported failure.".to_string())
                        } else {
                            fs::read(&pdf_path_for_callback)
                                .map_err(|error| format!("Unable to read WebView2 PDF output: {error}"))
                        };
                        let _ = fs::remove_file(&pdf_path_for_callback);
                        send_windows_artifact_result(&callback_sender, result);
                        Ok(())
                    }));
                    let core7 = match core.cast::<ICoreWebView2_7>() {
                        Ok(core7) => core7,
                        Err(error) => {
                            let _ = fs::remove_file(&pdf_path);
                            send_windows_artifact_result(
                                &sender,
                                Err(format!("WebView2 PDF export is unavailable: {error}")),
                            );
                            return;
                        }
                    };
                    let _keep_path_alive = path_wide;
                    if let Err(error) = unsafe {
                        core7.PrintToPdf(path_pointer, Option::<&webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2PrintSettings>::None, &handler)
                    } {
                        let _ = fs::remove_file(&pdf_path);
                        send_windows_artifact_result(
                            &sender,
                            Err(format!("Unable to start WebView2 PDF export: {error}")),
                        );
                    }
                }
            }
        })
        .map_err(|error| format!("Unable to schedule native Windows capture: {error}"))?;

    timeout(Duration::from_secs(30), receiver)
        .await
        .map_err(|_| "Windows rendered artifact capture timed out after 30 seconds.".to_string())?
        .map_err(|_| "Windows rendered artifact capture channel closed.".to_string())?
}

#[cfg(target_os = "windows")]
fn send_windows_artifact_result(sender: &WindowsArtifactSender, result: Result<Vec<u8>, String>) {
    if let Ok(mut sender) = sender.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(result);
        }
    }
}

#[cfg(target_os = "windows")]
fn read_com_stream(stream: &windows::Win32::System::Com::IStream) -> Result<Vec<u8>, String> {
    use windows::Win32::System::Com::STREAM_SEEK_SET;

    let mut position = 0u64;
    unsafe {
        stream
            .Seek(0, STREAM_SEEK_SET, Some(&mut position))
            .map_err(|error| format!("Unable to seek screenshot stream: {error}"))?;
    }
    let mut result = Vec::new();
    loop {
        let mut buffer = [0u8; 64 * 1024];
        let mut read = 0u32;
        let status = unsafe {
            stream.Read(
                buffer.as_mut_ptr().cast(),
                buffer.len() as u32,
                Some(&mut read),
            )
        };
        if status.is_err() {
            return Err(format!("Unable to read screenshot stream: {status:?}"));
        }
        if read == 0 {
            break;
        }
        result.extend_from_slice(&buffer[..read as usize]);
    }
    if result.is_empty() {
        return Err("WebView2 returned an empty screenshot.".into());
    }
    Ok(result)
}
