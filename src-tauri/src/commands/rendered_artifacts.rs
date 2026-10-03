use tauri::WebviewWindow;

use super::rendered_crawler::RenderedArtifactKind;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
mod windows_stream;

#[cfg(target_os = "macos")]
pub(crate) use macos::capture_macos;
#[cfg(target_os = "windows")]
pub(crate) use windows::capture_windows;

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
