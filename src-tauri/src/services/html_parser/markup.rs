use url::Url;

pub(super) fn aria_hidden_value(value: Option<&str>) -> bool {
    value.is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "true" | "1" | "yes"
        )
    })
}

pub fn resolve_url(href: &str, base: Option<&Url>) -> String {
    if let Some(base_url) = base {
        if let Ok(joined) = base_url.join(href) {
            return joined.to_string();
        }
    }
    href.to_string()
}

pub(super) fn semantic_style_hides(value: &str) -> bool {
    value.split(';').any(|declaration| {
        let Some((property, raw_value)) = declaration.split_once(':') else {
            return false;
        };
        let property = property.trim().to_ascii_lowercase();
        let value = raw_value
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_end_matches(';')
            .to_ascii_lowercase();
        matches!(
            (property.as_str(), value.as_str()),
            ("display", "none") | ("visibility", "hidden") | ("content-visibility", "hidden")
        )
    })
}
