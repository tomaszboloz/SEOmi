use scraper::{ElementRef, Html, Node, Selector};

pub(super) fn iframe_only(document: &Html) -> Option<usize> {
    let body = document
        .select(&Selector::parse("body").expect("body selector"))
        .next()?;
    let frames = body
        .select(&Selector::parse("iframe").expect("iframe selector"))
        .count();
    (frames > 0 && !has_visible_text_outside_frames(&body)).then_some(frames)
}

fn has_visible_text_outside_frames(body: &ElementRef<'_>) -> bool {
    body.descendants()
        .filter_map(|node| match node.value() {
            Node::Text(text) => {
                let text: &str = text;
                Some((node, text))
            }
            _ => None,
        })
        .any(|(node, text)| {
            let Some(parent) = node.parent().and_then(ElementRef::wrap) else {
                return false;
            };
            let excluded = is_excluded_text_container(&parent)
                || parent
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .any(|ancestor| is_excluded_text_container(&ancestor));
            !excluded && text.chars().any(char::is_alphanumeric)
        })
}

fn is_excluded_text_container(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(
        value.name(),
        "iframe" | "script" | "style" | "noscript" | "template"
    ) || value.attr("hidden").is_some()
        || value.attr("aria-hidden").is_some_and(|raw| {
            matches!(
                raw.trim().to_ascii_lowercase().as_str(),
                "true" | "1" | "yes"
            )
        })
    {
        return true;
    }
    value.attr("style").is_some_and(|style| {
        style
            .split(';')
            .filter_map(|decl| decl.split_once(':'))
            .any(|(name, raw)| {
                matches!(
                    name.trim().to_ascii_lowercase().as_str(),
                    "display" | "visibility"
                ) && matches!(raw.trim().to_ascii_lowercase().as_str(), "none" | "hidden")
            })
    })
}
