use super::*;

pub(in crate::services::html_parser) fn accessibility_control_snippet(
    control: &ElementRef<'_>,
) -> String {
    accessibility_element_snippet(control)
}

pub(in crate::services::html_parser) fn accessibility_element_snippet(
    control: &ElementRef<'_>,
) -> String {
    const SAFE_ATTRIBUTES: &[&str] = &[
        "id",
        "lang",
        "type",
        "name",
        "autocomplete",
        "placeholder",
        "class",
        "href",
        "role",
        "alt",
        "src",
        "loading",
        "width",
        "height",
        "title",
        "aria-label",
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "aria-owns",
        "aria-flowto",
        "aria-details",
        "aria-errormessage",
        "aria-hidden",
        "aria-disabled",
        "tabindex",
        "contenteditable",
    ];
    const BOOLEAN_ATTRIBUTES: &[&str] =
        &["required", "disabled", "readonly", "multiple", "checked"];

    let mut snippet = format!("<{}", control.value().name());
    for (name, value) in control.value().attrs() {
        if SAFE_ATTRIBUTES.contains(&name) && !value.is_empty() {
            let safe_value = if matches!(name, "href" | "src") {
                value.split(['?', '#']).next().unwrap_or(value)
            } else {
                value
            };
            let escaped = safe_value
                .replace('&', "&amp;")
                .replace('"', "&quot;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            snippet.push_str(&format!(" {name}=\"{escaped}\""));
        } else if BOOLEAN_ATTRIBUTES.contains(&name) {
            snippet.push_str(&format!(" {name}"));
        }
    }
    snippet.push('>');

    let mut bounded = snippet.chars().take(320).collect::<String>();
    if snippet.chars().count() > 320 {
        bounded.push('…');
    }
    bounded
}
