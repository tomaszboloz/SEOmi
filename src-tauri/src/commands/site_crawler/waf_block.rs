use reqwest::header::{HeaderMap, SERVER};

/// Name the protection layer that answered a throttled or blocked request.
/// Detection only: the crawler reacts by slowing down, never by evading.
pub(super) fn detect_waf_block(status: u16, headers: &HeaderMap) -> Option<&'static str> {
    if !matches!(status, 403 | 429 | 503) {
        return None;
    }
    let has = |name: &str| headers.contains_key(name);
    let server = headers
        .get(SERVER)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if has("cf-mitigated") || (has("cf-ray") && server.contains("cloudflare")) {
        Some("Cloudflare")
    } else if has("x-sucuri-id") {
        Some("Sucuri")
    } else if has("x-datadome") || server.contains("datadome") {
        Some("DataDome")
    } else if has("x-amzn-waf-action") {
        Some("AWS WAF")
    } else if has("x-iinfo") {
        Some("Imperva")
    } else if server.contains("akamaighost") {
        Some("Akamai")
    } else {
        None
    }
}

#[cfg(test)]
#[path = "waf_block_tests.rs"]
mod tests;
