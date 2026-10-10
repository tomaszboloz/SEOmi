use super::*;

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
    let rounded = parsed.round();
    (rounded.is_finite() && rounded >= 1.0 && rounded < usize::MAX as f64)
        .then_some(rounded as usize)
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
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.parse::<f64>())
        .collect::<Result<Vec<_>, _>>()
        .ok()?;
    if values.len() != 4 || values.iter().any(|value| !value.is_finite()) {
        return None;
    }
    svg_numeric_dimension(&values[2].to_string()).and_then(|width| {
        svg_numeric_dimension(&values[3].to_string()).map(|height| (width, height))
    })
}
