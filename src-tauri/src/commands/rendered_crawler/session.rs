use std::sync::{Arc, Mutex};
use tauri::Runtime;
use tauri::WindowEvent;
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

use super::models::CaptureEvent;
use super::navigation::CLEAR_SESSION_SCRIPT;
use crate::services::browser_proxy::BrowserRequestProxy;

pub struct RenderedCrawlerSession<R: Runtime = tauri::Wry> {
    pub(crate) window: tauri::WebviewWindow<R>,
    pub(crate) proxy: Option<BrowserRequestProxy>,
    pub(crate) receiver: mpsc::Receiver<CaptureEvent>,
    pub(crate) nonce: String,
    pub(crate) requested_url: String,
    /// True until the document loaded by `open` has been captured.
    pub(crate) initial_load_pending: bool,
    pub(crate) base_host: String,
    pub(crate) allow_subdomains: bool,
    pub(crate) scope_path: Option<String>,
    pub(crate) allowed_hosts: Vec<String>,
}

/// Listener handed to the window so its `Destroyed` event wakes `close_and_wait`.
pub(crate) fn destroyed_listener(
    sender: Arc<Mutex<Option<oneshot::Sender<()>>>>,
) -> impl Fn(&WindowEvent) + Send + Sync + 'static {
    move |event| notify_window_destroyed(event, &sender)
}

pub(crate) fn destroy_requested(result: tauri::Result<()>) -> bool {
    if let Err(error) = &result {
        log::warn!("renderer window destroy request failed: {error}");
    }
    result.is_ok()
}

pub(crate) async fn destruction_acknowledged(
    destroyed: oneshot::Receiver<()>,
    limit: Duration,
) -> bool {
    match timeout(limit, destroyed).await {
        Ok(Ok(())) => true,
        Ok(Err(_)) => {
            log::warn!("renderer window destroyed without a lifecycle acknowledgement");
            false
        }
        Err(_) => {
            log::warn!("renderer window destruction acknowledgement timed out");
            false
        }
    }
}

pub(crate) fn report_close_failure(result: tauri::Result<()>) {
    if let Err(error) = result {
        // Drop cannot report it; a hidden window left behind should at
        // least be visible in the log.
        log::warn!("renderer window could not be closed: {error}");
    }
}

pub(crate) fn notify_window_destroyed(
    event: &WindowEvent,
    sender: &Arc<Mutex<Option<oneshot::Sender<()>>>>,
) {
    if !matches!(event, WindowEvent::Destroyed) {
        return;
    }
    if let Ok(mut sender) = sender.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(());
        }
    }
}

/// Every renderer gets its own WebView2 user data folder. Sessions differ in
/// their `--proxy-server` port, and WebView2 refuses a second environment with
/// different browser arguments on a folder still held by the previous browser
/// process, which closed the capture channel of the next session.
#[cfg(target_os = "windows")]
pub(crate) fn windows_profile_dir(label: &str) -> std::path::PathBuf {
    std::env::temp_dir().join("seomi-renderer").join(label)
}

impl<R: Runtime> RenderedCrawlerSession<R> {
    pub fn close(self) {
        drop(self);
    }

    /// Destroy a renderer and wait until the native window has actually
    /// disappeared before a caller opens another isolated WebView2 session.
    /// Wry queues `destroy` on the event loop, so returning immediately can
    /// overlap the next WebView2 environment with the previous teardown.
    pub async fn close_and_wait(mut self) {
        let (destroyed_tx, destroyed_rx) = oneshot::channel();
        let destroyed_tx = Arc::new(Mutex::new(Some(destroyed_tx)));
        let window = self.window.clone();
        window.on_window_event(destroyed_listener(destroyed_tx));
        // When the native window confirms destruction, keep the explicit
        // shutdown marker so Drop does not enqueue a second destroy/close request.
        if destroy_requested(window.destroy())
            && destruction_acknowledged(destroyed_rx, Duration::from_secs(2)).await
        {
            self.proxy.take();
        }
        drop(self);
    }
}

impl<R: Runtime> Drop for RenderedCrawlerSession<R> {
    /// Closing on drop keeps hidden renderer windows from outliving a crawl
    /// that returned early, was cancelled or abandoned a failed session.
    fn drop(&mut self) {
        // Best effort: WebView2 may still hold files, in which case the
        // temporary profile is left for the OS temp cleanup.
        #[cfg(target_os = "windows")]
        let _ = std::fs::remove_dir_all(windows_profile_dir(self.window.label()));
        // An explicit close_and_wait already destroyed the native window.
        if self.proxy.is_none() {
            return;
        }
        // The renderer is incognito and is discarded after the run. Clear
        // script-visible state before closing as an additional defense for
        // platforms whose WebView keeps a short-lived page process alive.
        let _ = self.window.eval(CLEAR_SESSION_SCRIPT);
        // Renderer windows are owned by this session and never expose a user
        // close affordance. On Windows, direct destruction skips Wry's queued
        // CloseRequested route while WebView2 is handing off to another
        // isolated session.
        #[cfg(target_os = "windows")]
        let close_result = self.window.destroy();
        #[cfg(not(target_os = "windows"))]
        let close_result = self.window.close();
        report_close_failure(close_result);
        self.proxy.take();
    }
}
