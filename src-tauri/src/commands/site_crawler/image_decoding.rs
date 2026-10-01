use super::*;

pub(super) fn resource_type_enabled(resource_type: &str, config: &CrawlConfig) -> bool {
    match resource_type {
        "image" => config.crawl_images,
        "stylesheet" => config.crawl_stylesheets,
        "script" => config.crawl_scripts,
        _ => config.crawl_other_resources,
    }
}

pub(super) fn read_be_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_be_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

pub(super) fn read_be_u32(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u32::from_be_bytes([
        *bytes.get(offset)?,
        *bytes.get(offset + 1)?,
        *bytes.get(offset + 2)?,
        *bytes.get(offset + 3)?,
    ]) as usize)
}

pub(super) fn read_le_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_le_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

pub(super) fn read_le_u24(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(
        (*bytes.get(offset)? as usize)
            | ((*bytes.get(offset + 1)? as usize) << 8)
            | ((*bytes.get(offset + 2)? as usize) << 16),
    )
}

pub(super) fn parse_dimension_token(value: &str) -> Option<usize> {
    let value = value.trim();
    let numeric = value
        .strip_suffix("px")
        .unwrap_or(value)
        .trim()
        .parse::<f64>()
        .ok()?;
    (numeric.is_finite() && numeric > 0.0 && numeric <= usize::MAX as f64)
        .then_some(numeric as usize)
}

pub(super) fn svg_intrinsic_dimensions(bytes: &[u8]) -> Option<(usize, usize)> {
    let text = std::str::from_utf8(bytes).ok()?;
    let document = Html::parse_document(text);
    let selector = Selector::parse("svg").ok()?;
    let svg = document.select(&selector).next()?;
    let width = svg.value().attr("width").and_then(parse_dimension_token);
    let height = svg.value().attr("height").and_then(parse_dimension_token);
    if let (Some(width), Some(height)) = (width, height) {
        return Some((width, height));
    }
    let view_box = svg
        .value()
        .attr("viewBox")
        .or_else(|| svg.value().attr("viewbox"))?;
    let values = view_box
        .split(|character: char| character.is_ascii_whitespace() || character == ',')
        .filter_map(|value| value.trim().parse::<f64>().ok())
        .collect::<Vec<_>>();
    (values.len() >= 4 && values[2] > 0.0 && values[3] > 0.0)
        .then_some((values[2] as usize, values[3] as usize))
}

/// Decode only dimensions from a bounded, already-fetched image prefix. The
/// body itself is discarded immediately and never enters the persisted model.
pub(super) fn intrinsic_http_image_dimensions(
    content_type: Option<&str>,
    bytes: &[u8],
) -> Option<(usize, usize)> {
    if bytes.is_empty() || bytes.len() > MAX_INTRINSIC_IMAGE_BYTES {
        return None;
    }
    let content_type = content_type.unwrap_or("").to_ascii_lowercase();
    if content_type.contains("svg") || bytes.starts_with(b"<?xml") || bytes.starts_with(b"<svg") {
        return svg_intrinsic_dimensions(bytes);
    }
    // ICO files are the most common favicon format.  The directory contains
    // one or more image entries; choose the largest declared entry so the
    // report reflects the best available favicon candidate without decoding
    // the image body or executing any embedded content.
    if bytes.len() >= 6 && bytes.get(0..4) == Some(&[0, 0, 1, 0]) {
        let count = read_le_u16(bytes, 4)?.min(256);
        let mut largest: Option<(usize, usize)> = None;
        for index in 0..count {
            let offset = 6usize.saturating_add(index.saturating_mul(16));
            if offset.saturating_add(8) > bytes.len() {
                break;
            }
            let width = usize::from(bytes[offset]).max(1);
            let height = usize::from(bytes[offset + 1]).max(1);
            if largest.map_or(true, |(current_width, current_height)| {
                width.saturating_mul(height) > current_width.saturating_mul(current_height)
            }) {
                largest = Some((width, height));
            }
        }
        if largest.is_some() {
            return largest;
        }
    }
    if bytes.get(0..8) == Some(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        return Some((read_be_u32(bytes, 16)?, read_be_u32(bytes, 20)?));
    }
    if bytes.get(0..6) == Some(b"GIF87a") || bytes.get(0..6) == Some(b"GIF89a") {
        return Some((read_le_u16(bytes, 6)?, read_le_u16(bytes, 8)?));
    }
    if bytes.get(0..4) == Some(b"RIFF")
        && bytes.get(8..12) == Some(b"WEBP")
        && bytes.get(12..16) == Some(b"VP8X")
    {
        return Some((
            read_le_u24(bytes, 24)?.saturating_add(1),
            read_le_u24(bytes, 27)?.saturating_add(1),
        ));
    }
    if bytes.get(0..2) == Some(&[0xff, 0xd8]) {
        let mut offset = 2usize;
        while offset + 4 <= bytes.len() {
            if bytes[offset] != 0xff {
                offset += 1;
                continue;
            }
            while offset < bytes.len() && bytes[offset] == 0xff {
                offset += 1;
            }
            let marker = *bytes.get(offset)?;
            offset += 1;
            if marker == 0xd8 || marker == 0xd9 {
                continue;
            }
            let length = read_be_u16(bytes, offset)?;
            if length < 2 || offset.saturating_add(length) > bytes.len() {
                return None;
            }
            let is_sof = matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf);
            if is_sof && length >= 7 {
                return Some((
                    read_be_u16(bytes, offset + 5)?,
                    read_be_u16(bytes, offset + 3)?,
                ));
            }
            offset += length;
        }
    }
    None
}
