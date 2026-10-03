use super::*;

pub(in crate::services::html_parser) fn is_marked_anti_spam_text_control(
    control: &ElementRef<'_>,
) -> bool {
    is_explicitly_marked_anti_spam_control(control)
        || is_hidden_conventional_anti_spam_field(control)
}

pub(in crate::services::html_parser) fn is_explicitly_marked_anti_spam_control(
    control: &ElementRef<'_>,
) -> bool {
    let marker_attributes = ["id", "name", "class"]
        .iter()
        .filter_map(|attribute| control.value().attr(attribute))
        .collect::<Vec<_>>();
    let marker = marker_attributes.iter().any(|value| {
        let tokens = value
            .split(|character: char| !character.is_ascii_alphanumeric())
            .map(str::to_ascii_lowercase)
            .collect::<Vec<_>>();
        tokens
            .iter()
            .any(|token| matches!(token.as_str(), "honeypot" | "honeytrap" | "spamtrap"))
            || value
                .chars()
                .filter(char::is_ascii_alphanumeric)
                .collect::<String>()
                .to_ascii_lowercase()
                .contains("botfield")
    });

    if marker {
        return true;
    }

    false
}

/// An element inside `aria-hidden` is only actionable when it is otherwise
/// focusable. Boolean `hidden`/`inert` and static visibility declarations make
/// the browser remove it from keyboard focus, so they are not accessibility
/// violations of the `aria-hidden` focus rule themselves.
pub(in crate::services::html_parser) fn focusability_blocked_by_markup(
    element: &ElementRef<'_>,
) -> bool {
    let blocked = |candidate: ElementRef<'_>| {
        let value = candidate.value();
        value.attr("hidden").is_some()
            || value.attr("inert").is_some()
            || value.attr("style").is_some_and(semantic_style_hides)
    };
    blocked(*element)
        || element
            .ancestors()
            .filter_map(ElementRef::wrap)
            .any(blocked)
}

pub(in crate::services::html_parser) fn style_hides_control(value: &str) -> bool {
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
        let value = value.strip_suffix("!important").unwrap_or(&value);
        matches!(
            (property.as_str(), value),
            ("display", "none")
                | ("visibility", "hidden")
                | ("content-visibility", "hidden")
                | ("opacity", "0")
        ) || (property == "left" && value.starts_with('-'))
    })
}
