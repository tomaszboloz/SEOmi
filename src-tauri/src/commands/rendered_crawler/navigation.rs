use url::Url;

use super::models::{CaptureChunk, CAPTURE_SCHEME, MAX_CAPTURE_CHUNKS, MAX_CAPTURE_CHUNK_BYTES};
use crate::utils::url_validator::validate_and_normalize_url;

pub(crate) const CLEAR_SESSION_SCRIPT: &str = r#"(() => {
  try {
    for (const part of String(document.cookie || '').split(';')) {
      const name = part.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  } catch (_) {}
})();"#;

pub(crate) fn is_allowed_navigation(
    url: &Url,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
) -> bool {
    if url.scheme() != "http" && url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let Ok(validated) = validate_and_normalize_url(url.as_str()) else {
        return false;
    };
    let Some(host) = validated.host_str().map(str::to_ascii_lowercase) else {
        return false;
    };
    let base_host = base_host.to_ascii_lowercase();
    let host_in_scope =
        host == base_host || (allow_subdomains && host.ends_with(&format!(".{base_host}")));
    if !host_in_scope {
        return false;
    }
    let Some(scope_path) = scope_path.filter(|path| !path.trim().is_empty()) else {
        return true;
    };
    let path = validated.path();
    let normalized_scope = scope_path.trim_end_matches('/');
    path == normalized_scope
        || path
            .strip_prefix(normalized_scope)
            .is_some_and(|suffix| suffix.starts_with('/'))
}

pub(crate) fn parse_capture_chunk(url: &Url, nonce: &str) -> Option<CaptureChunk> {
    if url.scheme() != CAPTURE_SCHEME || url.host_str() != Some(nonce) {
        return None;
    }
    let mut parts = url.path_segments()?;
    let sequence = parts.next()?.parse().ok()?;
    let index = parts.next()?.parse().ok()?;
    let total = parts.next()?.parse().ok()?;
    if parts.next().is_some() || total == 0 || total > MAX_CAPTURE_CHUNKS || index >= total {
        return None;
    }
    let data = url
        .query_pairs()
        .find_map(|(name, value)| (name == "data").then(|| value.into_owned()))?;
    if data.is_empty() || data.len() > MAX_CAPTURE_CHUNK_BYTES {
        return None;
    }
    Some(CaptureChunk {
        sequence,
        index,
        total,
        data,
    })
}
