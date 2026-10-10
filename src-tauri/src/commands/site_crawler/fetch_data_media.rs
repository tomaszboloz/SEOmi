pub(crate) fn is_html_media_type(value: &str) -> bool {
    matches!(
        value
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "text/html" | "application/xhtml+xml"
    )
}
