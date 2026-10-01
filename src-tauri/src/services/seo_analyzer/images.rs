use crate::models::audit_data::{ImageData, Issue, IssueCategory, IssueSeverity};
use crate::services::html_parser::resolve_url;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use scraper::{Html, Selector};
use url::Url;

pub(super) fn infer_image_format(src: &str) -> Option<String> {
    let clean = src.split('?').next().unwrap_or(src);
    let clean = clean.split('#').next().unwrap_or(clean).to_lowercase();
    if clean.starts_with("data:image/") {
        let fmt = clean
            .trim_start_matches("data:image/")
            .split(';')
            .next()
            .unwrap_or("");
        return Some(fmt.to_string());
    }
    if clean.ends_with(".webp") {
        Some("webp".to_string())
    } else if clean.ends_with(".avif") {
        Some("avif".to_string())
    } else if clean.ends_with(".svg") {
        Some("svg".to_string())
    } else if clean.ends_with(".png") {
        Some("png".to_string())
    } else if clean.ends_with(".jpg") || clean.ends_with(".jpeg") {
        Some("jpeg".to_string())
    } else if clean.ends_with(".gif") {
        Some("gif".to_string())
    } else if clean.ends_with(".ico") {
        Some("ico".to_string())
    } else {
        None
    }
}

pub(super) fn parse_dimension_token(value: &str) -> Option<usize> {
    let trimmed = value.trim();
    if trimmed.ends_with('%') {
        return None;
    }
    let digits = trimmed
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return None;
    }
    let suffix = trimmed[digits.len()..].trim().to_ascii_lowercase();
    if !suffix.is_empty() && suffix != "px" {
        return None;
    }
    digits
        .parse::<usize>()
        .ok()
        .filter(|value| *value > 0 && *value <= 100_000)
}

pub(super) fn read_be_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(2)?;
    Some(u16::from_be_bytes(bytes.get(offset..end)?.try_into().ok()?) as usize)
}

pub(super) fn read_be_u32(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(4)?;
    Some(u32::from_be_bytes(bytes.get(offset..end)?.try_into().ok()?) as usize)
}

pub(super) fn read_le_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(2)?;
    Some(u16::from_le_bytes(bytes.get(offset..end)?.try_into().ok()?) as usize)
}

pub(super) fn read_le_u24(bytes: &[u8], offset: usize) -> Option<usize> {
    let end = offset.checked_add(3)?;
    let value = bytes.get(offset..end)?;
    Some((value[0] as usize) | ((value[1] as usize) << 8) | ((value[2] as usize) << 16))
}

pub(super) fn percent_decode_data(value: &str) -> Option<String> {
    fn hex_nibble(byte: u8) -> Option<u8> {
        match byte {
            b'0'..=b'9' => Some(byte - b'0'),
            b'a'..=b'f' => Some(byte - b'a' + 10),
            b'A'..=b'F' => Some(byte - b'A' + 10),
            _ => None,
        }
    }
    let mut output = Vec::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = hex_nibble(*bytes.get(index + 1)?)?;
            let low = hex_nibble(*bytes.get(index + 2)?)?;
            output.push((high << 4) | low);
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(output).ok()
}

pub(super) fn svg_data_uri_dimensions(text: &str) -> Option<(usize, usize)> {
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

/// Decode only bounded, local data-URI metadata. Network images intentionally
/// remain attribute-only until an optional resource request is performed.
pub(super) fn intrinsic_data_uri_dimensions(src: &str) -> Option<(usize, usize)> {
    let (header, payload) = src.split_once(',')?;
    let header_lower = header.to_ascii_lowercase();
    if !header_lower.starts_with("data:image/") {
        return None;
    }
    if header_lower.contains("svg+xml") {
        let decoded = if header_lower.contains(";base64") {
            String::from_utf8(BASE64_STANDARD.decode(payload).ok()?).ok()?
        } else {
            percent_decode_data(payload)?
        };
        return svg_data_uri_dimensions(&decoded);
    }
    let bytes = BASE64_STANDARD.decode(payload).ok()?;
    if bytes.len() > 8 * 1024 * 1024 {
        return None;
    }
    if header_lower.contains("png") && bytes.get(0..8) == Some(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        return Some((read_be_u32(&bytes, 16)?, read_be_u32(&bytes, 20)?));
    }
    if header_lower.contains("gif")
        && (bytes.get(0..6) == Some(b"GIF87a") || bytes.get(0..6) == Some(b"GIF89a"))
    {
        return Some((read_le_u16(&bytes, 6)?, read_le_u16(&bytes, 8)?));
    }
    if header_lower.contains("webp")
        && bytes.get(0..4) == Some(b"RIFF")
        && bytes.get(8..12) == Some(b"WEBP")
        && bytes.get(12..16) == Some(b"VP8X")
    {
        return Some((
            read_le_u24(&bytes, 24)?.saturating_add(1),
            read_le_u24(&bytes, 27)?.saturating_add(1),
        ));
    }
    if (header_lower.contains("jpeg") || header_lower.contains("jpg"))
        && bytes.get(0..2) == Some(&[0xff, 0xd8])
    {
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
            let length = read_be_u16(&bytes, offset)?;
            if length < 2 || offset + length > bytes.len() {
                return None;
            }
            let is_sof = matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf);
            if is_sof && length >= 7 {
                return Some((
                    read_be_u16(&bytes, offset + 5)?,
                    read_be_u16(&bytes, offset + 3)?,
                ));
            }
            offset += length;
        }
    }
    None
}

pub(super) fn parse_images(html_str: &str, base_url: &Url) -> (Vec<ImageData>, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut images = Vec::new();
    let mut issues = Vec::new();

    let img_selector = Selector::parse("img").unwrap();
    let mut missing_alt_count = 0;
    let mut missing_dim_count = 0;

    for el in document.select(&img_selector) {
        let src_attr = el.value().attr("src").unwrap_or("").trim();
        if src_attr.is_empty() {
            continue;
        }

        let full_src = resolve_url(src_attr, Some(base_url));
        let alt = el.value().attr("alt").map(|s| s.trim().to_string());
        let intrinsic_dimensions = intrinsic_data_uri_dimensions(&full_src);
        let width = el
            .value()
            .attr("width")
            .map(|s| s.trim().to_string())
            .or_else(|| intrinsic_dimensions.map(|dimensions| dimensions.0.to_string()));
        let height = el
            .value()
            .attr("height")
            .map(|s| s.trim().to_string())
            .or_else(|| intrinsic_dimensions.map(|dimensions| dimensions.1.to_string()));
        let has_width_attribute = el.value().attr("width").is_some();
        let has_height_attribute = el.value().attr("height").is_some();
        let dimensions_source = if has_width_attribute && has_height_attribute {
            Some("attributes".to_string())
        } else if intrinsic_dimensions.is_some() {
            Some(if has_width_attribute || has_height_attribute {
                "mixed".to_string()
            } else {
                "intrinsic-data-uri".to_string()
            })
        } else {
            None
        };
        let loading = el.value().attr("loading").map(|s| s.trim().to_string());
        let srcset = el.value().attr("srcset").map(|s| s.trim().to_string());

        // The empty alt attribute is itself the HTML signal for a decorative
        // image. aria-hidden/role are optional, not prerequisites.
        let decorative = alt.as_deref().is_some_and(|value| value.trim().is_empty());
        let has_alt = decorative || matches!(&alt, Some(value) if !value.trim().is_empty());

        if !has_alt && !decorative {
            missing_alt_count += 1;
        }

        if width.is_none() || height.is_none() {
            missing_dim_count += 1;
        }

        let format = infer_image_format(&full_src);

        images.push(ImageData {
            src: full_src,
            alt,
            width,
            height,
            loading,
            srcset,
            has_alt,
            format,
            dimensions_source,
        });
    }

    if missing_alt_count > 0 {
        let severity = if missing_alt_count > 5 {
            IssueSeverity::Critical
        } else {
            IssueSeverity::Warning
        };

        issues.push(Issue {
            severity,
            category: IssueCategory::Images,
            code: Some("images_alt_missing".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), missing_alt_count.to_string())])),
            message: format!("{} image(s) missing 'alt' descriptive text", missing_alt_count),
            recommendation: Some("Add descriptive alt attributes to all meaningful images for accessibility and image search ranking".to_string()),
        });
    }

    if missing_dim_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Info,
            category: IssueCategory::Images,
            code: Some("images_dimensions_missing".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), missing_dim_count.to_string())])),
            message: format!("{} image(s) missing explicit width/height dimensions (CLS risk)", missing_dim_count),
            recommendation: Some("Specify explicit width and height attributes on <img> elements to prevent Cumulative Layout Shift (CLS)".to_string()),
        });
    }

    (images, issues)
}
