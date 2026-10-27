use super::models::{CaptureEvent, RenderOptions, CAPTURE_SCHEME};
use super::navigation::{is_allowed_crawl_navigation, parse_capture_chunk, parse_transfer_failed};
use super::scripts::capture_script;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::webview::PageLoadEvent;
use tokio::sync::mpsc;
use url::Url;

pub(crate) fn capture_event_for_navigation(url: &Url, nonce: &str) -> Option<CaptureEvent> {
    parse_capture_chunk(url, nonce)
        .map(CaptureEvent::Chunk)
        .or_else(|| parse_transfer_failed(url, nonce).map(CaptureEvent::TransferFailed))
}

pub(crate) fn handle_session_navigation(
    url: &Url,
    nonce: &str,
    sender: &mpsc::Sender<CaptureEvent>,
    host: &str,
    allow_subdomains: bool,
    scope: Option<&str>,
    allowed_hosts: &[String],
) -> bool {
    if url.scheme() == CAPTURE_SCHEME {
        if let Some(event) = capture_event_for_navigation(url, nonce) {
            let _ = sender.blocking_send(event);
        }
        return false;
    }
    is_allowed_crawl_navigation(url, host, allow_subdomains, scope, allowed_hosts)
}

pub(crate) fn handle_session_page_load(
    event: PageLoadEvent,
    urls: (Option<&Url>, &Url),
    sequence: &AtomicU64,
    sender: &mpsc::Sender<CaptureEvent>,
    nonce: &str,
    options: &RenderOptions,
    eval: impl FnOnce(&str),
) {
    if event != PageLoadEvent::Finished || urls.0 != Some(urls.1) {
        return;
    }
    let current_sequence = sequence.fetch_add(1, Ordering::Relaxed) + 1;
    if sender
        .blocking_send(CaptureEvent::PageReady(current_sequence))
        .is_err()
    {
        return;
    }
    let script = capture_script(nonce, current_sequence, options);
    eval(&script);
}
