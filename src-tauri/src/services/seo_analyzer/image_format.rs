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
