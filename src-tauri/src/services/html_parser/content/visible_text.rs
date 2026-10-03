use super::*;

pub(in crate::services::html_parser) fn visible_content_text(document: &Html) -> Option<String> {
    let body_selector = Selector::parse("body").unwrap();
    let body_el = document.select(&body_selector).next()?;

    // Keep only visible text nodes from the semantic content region. Site
    // chrome (header/nav/footer/sidebar/form) must not influence SEO terms or
    // readability, while a document without a primary root conservatively
    // falls back to its body.
    let has_primary_root = has_semantic_content_root(document);
    let visible_text = body_el
        .descendants()
        .filter_map(|node| {
            let Node::Text(text) = node.value() else {
                return None;
            };
            let parent = node.parent().and_then(ElementRef::wrap)?;
            if !semantic_content_contains(&parent, has_primary_root)
                || matches!(
                    parent.value().name(),
                    "script" | "style" | "noscript" | "svg" | "template"
                )
                || parent
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .any(|ancestor| {
                        matches!(
                            ancestor.value().name(),
                            "script" | "style" | "noscript" | "svg" | "template"
                        )
                    })
            {
                return None;
            }
            Some(text.text.as_ref())
        })
        .collect::<Vec<_>>()
        .join(" ");
    let full_text = visible_text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    Some(full_text)
}
