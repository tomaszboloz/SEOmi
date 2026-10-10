#[cfg(target_os = "windows")]
use {
    super::super::rendered_crawler::RenderedArtifactKind,
    super::windows_stream::read_com_stream,
    std::fs,
    std::sync::{Arc, Mutex},
    std::time::Duration,
    tauri::{Runtime, WebviewWindow},
    tokio::sync::oneshot,
    tokio::time::timeout,
};

#[cfg(target_os = "windows")]
type WindowsArtifactSender = Arc<Mutex<Option<oneshot::Sender<Result<Vec<u8>, String>>>>>;

#[cfg(target_os = "windows")]
pub(crate) async fn capture_windows<R: Runtime>(
    window: &WebviewWindow<R>,
    kind: RenderedArtifactKind,
) -> Result<Vec<u8>, String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_7, COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
    };
    use webview2_com::{CapturePreviewCompletedHandler, PrintToPdfCompletedHandler};
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Com::IStream;
    use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;

    let (sender, receiver) = oneshot::channel::<Result<Vec<u8>, String>>();
    let sender: WindowsArtifactSender = Arc::new(Mutex::new(Some(sender)));
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
                    let callback_sender = Arc::clone(&sender);
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
                    let callback_sender = Arc::clone(&sender);
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
