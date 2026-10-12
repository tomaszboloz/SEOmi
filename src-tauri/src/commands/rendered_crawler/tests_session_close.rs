use super::{models::CaptureEvent, session::RenderedCrawlerSession};
use crate::{services::browser_proxy::BrowserRequestProxy, utils::test_app::StorageApp};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

async fn fixture(
    label: &str,
    with_proxy: bool,
) -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, label, Default::default())
        .build()
        .unwrap();
    let (_sender, receiver) = mpsc::channel::<CaptureEvent>(1);
    let proxy = if with_proxy {
        Some(BrowserRequestProxy::start().await.unwrap())
    } else {
        None
    };
    let session = RenderedCrawlerSession {
        window,
        proxy,
        receiver,
        nonce: "close-test-nonce".into(),
        requested_url: "https://example.test/".into(),
        initial_load_pending: true,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: None,
        allowed_hosts: Vec::new(),
    };
    (app, session)
}

#[tokio::test(start_paused = true)]
async fn close_and_wait_finishes_without_a_proxy() {
    let (_app, session) = fixture("close-wait-plain", false).await;
    session.close_and_wait().await;
}

#[tokio::test(start_paused = true)]
async fn close_and_wait_finishes_with_a_running_proxy() {
    let (_app, session) = fixture("close-wait-proxy", true).await;
    session.close_and_wait().await;
}

#[tokio::test]
async fn dropping_a_session_with_a_proxy_closes_the_window() {
    let (_app, session) = fixture("drop-proxy", true).await;
    drop(session);
}

#[tokio::test(start_paused = true)]
async fn close_and_wait_tolerates_a_window_that_is_already_gone() {
    let (_app, session) = fixture("close-wait-gone", true).await;
    let _ = session.window.clone().destroy();
    session.close_and_wait().await;
}
