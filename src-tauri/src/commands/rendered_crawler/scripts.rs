use super::models::{
    RenderOptions, DOM_IDLE_MAX_WAIT_MS, DOM_IDLE_QUIET_MS, MAX_CAPTURE_CHUNKS,
    MAX_CAPTURE_CHUNK_BYTES, MAX_CAPTURE_HTML_CHARS, NETWORK_IDLE_MAX_WAIT_MS,
    NETWORK_IDLE_POLL_MS, NETWORK_IDLE_QUIET_MS,
};

pub(crate) fn cookie_bootstrap_script(cookie_header: &str) -> String {
    let encoded = serde_json::to_string(cookie_header).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(() => {{
  const header = {encoded};
  for (const part of String(header || '').split(';')) {{
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name || !value || /[=;\s]/.test(name)) continue;
    try {{ document.cookie = `${{name}}=${{value}}; path=/`; }} catch (_) {{}}
  }}
}})();"#
    )
}

pub(crate) fn capture_script(nonce: &str, sequence: u64, options: &RenderOptions) -> String {
    let nonce = serde_json::to_string(nonce).unwrap_or_else(|_| "\"\"".into());
    let selector =
        serde_json::to_string(&options.wait_for_selector).unwrap_or_else(|_| "null".into());
    let sequence = sequence.min(u64::MAX - 1);
    let wait_delay_ms = options.wait_delay_ms.min(10_000);
    let scroll_cycles = options.lazy_scroll_cycles.min(40);

    let runtime = include_str!("capture_runtime.js")
        .replace("__NONCE__", &nonce)
        .replace("__SEQUENCE__", &sequence.to_string())
        .replace("__WAIT_SELECTOR__", &selector)
        .replace("__WAIT_DELAY_MS__", &wait_delay_ms.to_string())
        .replace("__SCROLL_CYCLES__", &scroll_cycles.to_string())
        .replace(
            "__NETWORK_IDLE_MAX_WAIT_MS__",
            &NETWORK_IDLE_MAX_WAIT_MS.to_string(),
        )
        .replace(
            "__NETWORK_IDLE_QUIET_MS__",
            &NETWORK_IDLE_QUIET_MS.to_string(),
        )
        .replace(
            "__NETWORK_IDLE_POLL_MS__",
            &NETWORK_IDLE_POLL_MS.to_string(),
        )
        .replace(
            "__DOM_IDLE_MAX_WAIT_MS__",
            &DOM_IDLE_MAX_WAIT_MS.to_string(),
        )
        .replace("__DOM_IDLE_QUIET_MS__", &DOM_IDLE_QUIET_MS.to_string());

    let collector = include_str!("capture_collector.js")
        .replace(
            "__MAX_CAPTURE_HTML_CHARS__",
            &MAX_CAPTURE_HTML_CHARS.to_string(),
        )
        .replace(
            "__TRANSPORT__",
            include_str!("../render_capture_transport.js"),
        )
        .replace(
            "__MAX_CAPTURE_CHUNK_BYTES__",
            &MAX_CAPTURE_CHUNK_BYTES.to_string(),
        )
        .replace("__MAX_CAPTURE_CHUNKS__", &MAX_CAPTURE_CHUNKS.to_string());

    format!("(() => {{\n{runtime}\n{collector}\n}})();")
}
