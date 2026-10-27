use super::{
    models::{CaptureEvent, RenderOptions},
    session::RenderedCrawlerSession,
    session_open_handlers::{
        capture_event_for_navigation, handle_session_navigation, handle_session_page_load,
    },
};
use crate::utils::test_app::StorageApp;
use std::sync::atomic::AtomicU64;
use tauri::{test::mock_builder, webview::PageLoadEvent};
use tokio::sync::mpsc;
use url::Url;

#[path = "tests_session_open_coverage_part1.rs"]
mod part1;
#[path = "tests_session_open_coverage_part2.rs"]
mod part2;
