use super::*;

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
    if values.len() >= 4 && values[2] > 0.0 && values[3] > 0.0 {
        Some((values[2] as usize, values[3] as usize))
    } else {
        None
    }
}
