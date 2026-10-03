use super::*;

pub(super) fn bounded_inline_image_uri(value: &str) -> String {
    if value.chars().count() <= MAX_INLINE_IMAGE_URI_CHARS {
        return value.to_string();
    }
    let mut bounded = value
        .chars()
        .take(MAX_INLINE_IMAGE_URI_CHARS)
        .collect::<String>();
    bounded.push_str("…[truncated]");
    bounded
}

/// Decode only bounded image data URIs. This is deliberately local:
/// no image request, browser decode, SVG execution or arbitrary data URI is
/// allowed during a static crawl.
pub(super) fn inline_image_dimensions(src: &str) -> Option<(usize, usize)> {
    let (header, payload) = src.split_once(',')?;
    let header_lower = header.to_ascii_lowercase();
    if !header_lower.starts_with("data:image/") {
        return None;
    }
    if payload.len() > 2_000_000 {
        return None;
    }
    let mime = header_lower
        .strip_prefix("data:")?
        .split(';')
        .next()
        .unwrap_or_default();
    if mime == "image/svg+xml" {
        return svg_inline_dimensions(src);
    }
    if !header_lower.contains(";base64") {
        return None;
    }
    let bytes = BASE64_STANDARD.decode(payload.as_bytes()).ok()?;
    match mime {
        "image/png"
            if bytes.len() >= 24 && bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) =>
        {
            let width = u32::from_be_bytes(bytes[16..20].try_into().ok()?) as usize;
            let height = u32::from_be_bytes(bytes[20..24].try_into().ok()?) as usize;
            (width > 0 && height > 0).then_some((width, height))
        }
        "image/gif"
            if bytes.len() >= 10
                && (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) =>
        {
            let width = u16::from_le_bytes(bytes[6..8].try_into().ok()?) as usize;
            let height = u16::from_le_bytes(bytes[8..10].try_into().ok()?) as usize;
            (width > 0 && height > 0).then_some((width, height))
        }
        _ => None,
    }
}

pub(super) fn inline_image_format(src: &str) -> Option<String> {
    let header = src.split_once(',')?.0.to_ascii_lowercase();
    let mime = header
        .strip_prefix("data:image/")?
        .split(';')
        .next()
        .filter(|value| !value.is_empty())?;
    Some(mime.to_string())
}
