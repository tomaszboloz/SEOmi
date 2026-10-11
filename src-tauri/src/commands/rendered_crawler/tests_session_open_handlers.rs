use super::{
    models::{CaptureEvent, RenderOptions},
    session_open_handlers::{handle_session_navigation, handle_session_page_load},
};
use std::sync::atomic::AtomicU64;
use tauri::webview::PageLoadEvent;
use tokio::sync::mpsc;
use url::Url;

#[test]
fn session_navigation_handler_coverage() {
    let nonce = "nav-nonce";
    let (tx, mut rx) = mpsc::channel(10);
    let allowed = vec!["cdn.example.test".to_string()];

    let chunk_url = Url::parse(&format!("seomi-capture://{nonce}/1/0/1?data=xyz")).unwrap();
    assert!(!handle_session_navigation(
        &chunk_url,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));
    assert!(matches!(rx.try_recv(), Ok(CaptureEvent::Chunk(_))));

    let err_url = Url::parse(&format!("seomi-capture://{nonce}/1/error")).unwrap();
    assert!(!handle_session_navigation(
        &err_url,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));
    assert!(matches!(rx.try_recv(), Ok(CaptureEvent::TransferFailed(1))));

    let ok_url = Url::parse("https://example.test/about").unwrap();
    assert!(handle_session_navigation(
        &ok_url,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));

    let dis_url = Url::parse("https://other.com/").unwrap();
    assert!(!handle_session_navigation(
        &dis_url,
        nonce,
        &tx,
        "example.test",
        false,
        None,
        &allowed
    ));
}

#[test]
fn session_page_load_handler_coverage() {
    let (tx, rx) = mpsc::channel(10);
    let seq = AtomicU64::new(0);
    let options = RenderOptions::default();
    let url = Url::parse("https://example.test/").unwrap();
    let other_url = Url::parse("https://example.test/other").unwrap();

    let mut evalled = false;
    handle_session_page_load(
        PageLoadEvent::Started,
        (Some(&url), &url),
        &seq,
        &tx,
        "n",
        &options,
        |_| evalled = true,
    );
    assert!(!evalled);

    handle_session_page_load(
        PageLoadEvent::Finished,
        (Some(&other_url), &url),
        &seq,
        &tx,
        "n",
        &options,
        |_| evalled = true,
    );
    assert!(!evalled);

    drop(rx);
    handle_session_page_load(
        PageLoadEvent::Finished,
        (Some(&url), &url),
        &seq,
        &tx,
        "n",
        &options,
        |_| evalled = true,
    );
    assert!(!evalled);

    let (tx2, mut rx2) = mpsc::channel(10);
    handle_session_page_load(
        PageLoadEvent::Finished,
        (Some(&url), &url),
        &seq,
        &tx2,
        "n",
        &options,
        |_| evalled = true,
    );
    assert!(evalled);
    assert!(matches!(rx2.try_recv(), Ok(CaptureEvent::PageReady(2))));
}
