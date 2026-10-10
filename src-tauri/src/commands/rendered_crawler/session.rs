use tauri::Runtime;
use tokio::sync::mpsc;

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

impl<R: Runtime> RenderedCrawlerSession<R> {
    pub fn close(self) {
        drop(self);
    }
}

impl<R: Runtime> Drop for RenderedCrawlerSession<R> {
    /// Closing on drop keeps hidden renderer windows from outliving a crawl
    /// that returned early, was cancelled or abandoned a failed session.
    fn drop(&mut self) {
        // The renderer is incognito and is discarded after the run. Clear
        // script-visible state before closing as an additional defense for
        // platforms whose WebView keeps a short-lived page process alive.
        let _ = self.window.eval(CLEAR_SESSION_SCRIPT);
        if let Err(error) = self.window.close() {
            // Drop cannot report it; a hidden window left behind should at
            // least be visible in the log.
            log::warn!("renderer window could not be closed: {error}");
        }
        self.proxy.take();
    }
}
