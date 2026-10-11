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
        let event_sender = Arc::clone(&destroyed_tx);
        window.on_window_event(move |event| {
            notify_window_destroyed(event, &event_sender);
        });
        let destroy_requested = match window.destroy() {
            Ok(()) => true,
            Err(error) => {
                log::warn!("renderer window destroy request failed: {error}");
                false
            }
        };
        if destroy_requested {
            match timeout(Duration::from_secs(2), destroyed_rx).await {
                Ok(Ok(())) => {
                    // The native window confirmed destruction. Keep the
                    // explicit shutdown marker so Drop does not enqueue a
                    // second destroy/close request.
                    self.proxy.take();
                }
                Ok(Err(_)) => {
                    log::warn!("renderer window destroyed without a lifecycle acknowledgement");
                }
                Err(_) => {
                    log::warn!("renderer window destruction acknowledgement timed out");
                }
            }
        }
        drop(self);
    }
}

impl<R: Runtime> Drop for RenderedCrawlerSession<R> {
    /// Closing on drop keeps hidden renderer windows from outliving a crawl
    /// that returned early, was cancelled or abandoned a failed session.
    fn drop(&mut self) {
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
        if let Err(error) = close_result {
            // Drop cannot report it; a hidden window left behind should at
            // least be visible in the log.
            log::warn!("renderer window could not be closed: {error}");
        }
        self.proxy.take();
    }
}
