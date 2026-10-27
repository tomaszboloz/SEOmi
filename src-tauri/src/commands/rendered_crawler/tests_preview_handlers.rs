use super::preview_handlers::{handle_preview_navigation, handle_preview_page_load};
use tauri::webview::PageLoadEvent;
use url::Url;

#[test]
fn preview_navigation_handler_allows_host_and_blocks_others() {
    let host = "example.test";
    let allowed = Url::parse("https://example.test/section/page").unwrap();
    assert!(handle_preview_navigation(&allowed, host));

    let blocked_ext = Url::parse("https://other.test/page").unwrap();
    assert!(!handle_preview_navigation(&blocked_ext, host));

    let blocked_sub = Url::parse("https://sub.example.test/page").unwrap();
    assert!(!handle_preview_navigation(&blocked_sub, host));
}

#[test]
fn preview_page_load_handler_triggers_eval_only_on_finished() {
    let mut eval_called = false;
    handle_preview_page_load(PageLoadEvent::Started, || {
        eval_called = true;
    });
    assert!(!eval_called);

    handle_preview_page_load(PageLoadEvent::Finished, || {
        eval_called = true;
    });
    assert!(eval_called);
}

#[test]
fn preview_navigation_rejects_active_schemes_credentials_and_host_lookalikes() {
    for value in [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html,hello",
        "https://example.test.evil.test/",
        "https://user:secret@example.test/",
        "http://127.0.0.1/",
        "https://evil.test/?next=https://example.test/",
    ] {
        let url = Url::parse(value).unwrap();
        assert!(!handle_preview_navigation(&url, "example.test"), "{value}");
    }
}
