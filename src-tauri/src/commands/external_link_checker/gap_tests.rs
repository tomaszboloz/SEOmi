use super::concurrency::host_key;
use super::result::{new_chain_state, record_redirect, timeout_result};

#[test]
fn unparseable_urls_fall_back_to_their_trimmed_lowercase_text() {
    assert_eq!(host_key("  http://  "), "http://");
    assert_eq!(host_key("https://Example.COM/a"), "example.com");
}

#[test]
fn poisoned_redirect_state_is_ignored_instead_of_panicking() {
    let state = new_chain_state();
    let poisoner = state.clone();
    let _ = std::thread::spawn(move || {
        let _guard = poisoner.lock().unwrap();
        panic!("poison the redirect state");
    })
    .join();
    record_redirect(&state, "https://e.test/next");
    let result = timeout_result("https://e.test/".into(), &state);
    assert_eq!(result.request_error_kind.as_deref(), Some("timeout"));
    assert!(result.redirect_url.is_none());
}
