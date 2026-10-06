use super::*;
use crate::commands::rendered_crawler::{CaptureChunk, CaptureEvent, RenderedCrawlerSession};
use crate::utils::test_app::StorageApp;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

pub(super) fn rendered_setup() -> CrawlSetup {
    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    setup(config)
}

pub(super) fn empty_state() -> CrawlLoopState<MockRuntime> {
    CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    )
}

pub(super) fn payload() -> String {
    URL_SAFE_NO_PAD.encode(br#"{"page_url":"https://example.test/rendered","http_status":200,"content_type":"text/html","charset":"utf-8","html":"<main>ok</main>","html_truncated":false,"navigation_time_ms":12,"lcp_ms":45,"inp_ms":3,"cls":0.1,"failed_resource_urls":[],"console_errors":[]}"#)
}

pub(super) fn chunk(
    sequence: u64,
    index: usize,
    total: usize,
    data: impl Into<String>,
) -> CaptureEvent {
    CaptureEvent::Chunk(CaptureChunk {
        sequence,
        index,
        total,
        data: data.into(),
    })
}

pub(super) fn session(
    events: Vec<CaptureEvent>,
    hold_sender: bool,
) -> (
    StorageApp,
    RenderedCrawlerSession<MockRuntime>,
    Option<mpsc::Sender<CaptureEvent>>,
) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, "page-fetch-contract", Default::default())
        .build()
        .unwrap();
    let (sender, receiver) = mpsc::channel(16);
    for event in events {
        sender.try_send(event).unwrap();
    }
    let held = if hold_sender {
        Some(sender)
    } else {
        drop(sender);
        None
    };
    let session = RenderedCrawlerSession {
        window,
        proxy: None,
        receiver,
        nonce: "page-fetch".into(),
        requested_url: "https://example.test/rendered".into(),
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: None,
    };
    (app, session, held)
}
