use super::models::RenderOptions;
use super::scripts::{capture_script, cookie_bootstrap_script};

#[test]
fn renderer_wait_and_scroll_limits_are_applied_to_the_injected_script() {
    let script = capture_script(
        "token",
        4,
        &RenderOptions {
            user_agent: None,
            cookie: None,
            wait_for_selector: Some("main".into()),
            wait_delay_ms: u64::MAX,
            lazy_scroll_cycles: usize::MAX,
        },
    );
    assert!(script.contains("const waitDelayMs = 10000;"));
    assert!(script.contains("const scrollCycles = 40;"));
    assert!(script.contains("const scrollPauseMs = 250;"));
    assert!(script.contains("const waitForNetworkIdle = async"));
    assert!(script.contains("type: 'resource', buffered: true"));
    assert!(script.contains("Date.now() - lastResourceActivity < 500"));
    assert!(script.contains("await waitForNetworkIdle();"));
    assert!(script.contains("const waitForDomIdle = async"));
    assert!(script.contains("Date.now() - lastMutation < 500"));
    assert!(script.contains("childList: true, subtree: true, attributes: true"));
    assert!(script.contains("const originalConsoleError"));
    assert!(script.contains("console.error = (...args)"));
    assert!(script.contains("console.error = originalConsoleError"));
    assert!(script.contains("document.querySelector(waitSelector)"));
    assert!(script.contains("const observer = typeof MutationObserver === 'function'"));
    assert!(script.contains("if (stableScrollCycles >= 3) break;"));
    assert!(script.contains("observer?.disconnect();"));
    assert!(script.contains("lcp_ms:"));
    assert!(script.contains("inp_ms:"));
    assert!(script.contains("cls:"));
    assert!(script.contains("PerformanceObserver"));
    assert!(script.contains("durationThreshold: 16"));
    assert!(script.contains("entry.startTime - previousTime > 1000"));
    assert!(script.contains("seomi-capture://"));
}

#[test]
fn capture_script_base64url_regexes_are_valid_javascript() {
    let script = capture_script("nonce", 1, &RenderOptions::default());
    assert!(script.contains(r"replace(/\+/g, '-').replace(/\//g, '_')"));
    assert!(!script.contains(r"/\\"));
}

#[test]
fn capture_script_uses_acknowledged_transfer_instead_of_overlapping_navigations() {
    let script = capture_script("nonce", 1, &RenderOptions::default());
    assert!(script.contains("await sendCaptureChunks(encoded, nonce, sequence"));
    assert!(script.contains("seomi-capture-ack"));
    assert!(!script.contains("index * 4"));
}

#[test]
fn cookie_bootstrap_script_uses_cookie_pairs_without_logging_values() {
    let script = cookie_bootstrap_script("session=opaque; consent=yes");

    assert!(script.contains("const header ="));
    assert!(script.contains("document.cookie"));
    assert!(script.contains("path=/"));
    assert!(!script.contains("console.log"));
    assert!(!script.contains("console.error"));
}

#[test]
fn render_options_default_to_no_cookie_bootstrap() {
    assert!(RenderOptions::default().cookie.is_none());
}
