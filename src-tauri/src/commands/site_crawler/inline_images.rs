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

pub(super) fn decode_inline_text_payload(payload: &str) -> Option<String> {
    if payload.len() > 1_000_000 {
        return None;
    }
    let mut bytes = Vec::with_capacity(payload.len());
    let raw = payload.as_bytes();
    let mut index = 0;
    while index < raw.len() {
        if raw[index] == b'%' {
            if index + 2 >= raw.len() {
                return None;
            }
            let high = (raw[index + 1] as char).to_digit(16)? as u8;
            let low = (raw[index + 2] as char).to_digit(16)? as u8;
            bytes.push((high << 4) | low);
            index += 3;
        } else {
            bytes.push(raw[index]);
            index += 1;
        }
    }
    String::from_utf8(bytes).ok()
}

pub(super) fn svg_attribute(svg: &str, name: &str) -> Option<String> {
    let lower = svg.to_ascii_lowercase();
    let name_lower = name.to_ascii_lowercase();
    let mut offset = 0;
    while let Some(relative) = lower[offset..].find(&name_lower) {
        let start = offset + relative;
        let after_name = start + name_lower.len();
        let rest = lower[after_name..].trim_start();
        if let Some(after_equals) = rest.strip_prefix('=') {
            let quote = after_equals.trim_start().chars().next()?;
            if quote != '\'' && quote != '"' {
                offset = after_name;
                continue;
            }
            let value = &svg[after_name..];
            let value = &value[value.find(quote)? + 1..];
            return Some(value[..value.find(quote)?].trim().to_string());
        }
        offset = after_name;
    }
    None
}

pub(super) fn svg_numeric_dimension(value: &str) -> Option<usize> {
    let value = value.trim();
    if value.is_empty() || value.ends_with('%') {
        return None;
    }
    let value = value.strip_suffix("px").unwrap_or(value).trim();
    let parsed = value.parse::<f64>().ok()?;
    (parsed.is_finite() && parsed > 0.0).then_some(parsed.round() as usize)
}

pub(super) fn svg_inline_dimensions(src: &str) -> Option<(usize, usize)> {
    let (_, payload) = src.split_once(',')?;
    let header = src.split_once(',')?.0.to_ascii_lowercase();
    let svg = if header.contains(";base64") {
        let bytes = BASE64_STANDARD.decode(payload.as_bytes()).ok()?;
        String::from_utf8(bytes).ok()?
    } else {
        decode_inline_text_payload(payload)?
    };
    let width = svg_attribute(&svg, "width").and_then(|value| svg_numeric_dimension(&value));
    let height = svg_attribute(&svg, "height").and_then(|value| svg_numeric_dimension(&value));
    if let (Some(width), Some(height)) = (width, height) {
        return Some((width, height));
    }
    let view_box = svg_attribute(&svg, "viewbox")?;
    let values = view_box
        .split(|character: char| character.is_ascii_whitespace() || character == ',')
        .filter_map(|value| value.parse::<f64>().ok())
        .collect::<Vec<_>>();
    if values.len() < 4 || !values[2].is_finite() || !values[3].is_finite() {
        return None;
    }
    svg_numeric_dimension(&values[2].to_string()).and_then(|width| {
        svg_numeric_dimension(&values[3].to_string()).map(|height| (width, height))
    })
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

pub(super) fn parse_srcset_urls(srcset: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut position = 0;
    while position < srcset.len() {
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            if character == ',' || character.is_ascii_whitespace() {
                position += character.len_utf8();
            } else {
                break;
            }
        }
        if position >= srcset.len() {
            break;
        }

        let url_start = position;
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            if character.is_ascii_whitespace() {
                break;
            }
            position += character.len_utf8();
        }
        let raw_url = &srcset[url_start..position];
        let url = raw_url.trim_end_matches(',');
        if !url.is_empty() {
            urls.push(url.to_string());
        }
        if raw_url.ends_with(',') {
            continue;
        }

        let mut parentheses = 0usize;
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            position += character.len_utf8();
            match character {
                '(' => parentheses = parentheses.saturating_add(1),
                ')' => parentheses = parentheses.saturating_sub(1),
                ',' if parentheses == 0 => break,
                _ => {}
            }
        }
    }
    urls
}
