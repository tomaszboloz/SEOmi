use super::*;

pub(in crate::commands::site_crawler) fn svg_attribute(svg: &str, name: &str) -> Option<String> {
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

pub(in crate::commands::site_crawler) fn svg_numeric_dimension(value: &str) -> Option<usize> {
    let value = value.trim();
    if value.is_empty() || value.ends_with('%') {
        return None;
    }
    let value = value.strip_suffix("px").unwrap_or(value).trim();
    let parsed = value.parse::<f64>().ok()?;
    (parsed.is_finite() && parsed > 0.0).then_some(parsed.round() as usize)
}

pub(in crate::commands::site_crawler) fn svg_inline_dimensions(
    src: &str,
) -> Option<(usize, usize)> {
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
