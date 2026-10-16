use super::focus_counter::{FocusCounter, STRONG_ZONE_WEIGHT};
use super::semantic_chrome::{
    has_semantic_content_root, semantic_chrome_element, semantic_content_contains,
};
use super::*;

const SUB_HEADING_WEIGHT: f32 = 1.5;
const MAX_HEADINGS_PER_LEVEL: usize = 20;
const MAX_HEADING_CHARS: usize = 160;

fn clean_text(element: &ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Zone-weighted n-gram counts and heading texts for the Site Focus Score.
pub(super) fn extract_page_focus(
    document: &Html,
    language: Option<&str>,
    title: Option<&str>,
    meta_description: Option<&str>,
) -> CrawledPageFocus {
    let body = semantic_content_text(document);
    let has_root = has_semantic_content_root(document);
    let mut counter = FocusCounter::new(language);
    counter.observe(&body, 1.0, true);
    counter.observe(title.unwrap_or_default(), STRONG_ZONE_WEIGHT, true);
    counter.observe(meta_description.unwrap_or_default(), 1.0, true);
    let images = Selector::parse("img[alt]").expect("static alt selector valid");
    for image in document.select(&images) {
        if semantic_content_contains(&image, has_root) {
            counter.observe(image.value().attr("alt").unwrap_or_default(), 1.0, true);
        }
    }
    let mut headings = HeadingTexts::default();
    let selector = Selector::parse("h1, h2, h3").expect("static heading selector valid");
    for heading in document.select(&selector) {
        let text = clean_text(&heading);
        let (zone, weight) = match heading.value().name() {
            "h1" => (&mut headings.h1, STRONG_ZONE_WEIGHT),
            "h2" => (&mut headings.h2, SUB_HEADING_WEIGHT),
            _ => (&mut headings.h3, SUB_HEADING_WEIGHT),
        };
        if text.is_empty() || semantic_ancestor_hidden(&heading) {
            continue;
        }
        // Headings inside the body text already carry weight 1.
        let in_body = semantic_content_contains(&heading, has_root);
        counter.observe(&text, if in_body { weight - 1.0 } else { weight }, !in_body);
        if zone.len() < MAX_HEADINGS_PER_LEVEL {
            zone.push(text.chars().take(MAX_HEADING_CHARS).collect());
        }
    }
    CrawledPageFocus {
        content_date: super::focus_date::document_date(document),
        focus_terms: counter.into_terms(),
        heading_texts: headings,
        focus_text_chars: body.chars().count().min(u32::MAX as usize) as u32,
    }
}

/// True when the heading sits in navigation/footer/aside/form or is hidden.
fn semantic_ancestor_hidden(element: &ElementRef<'_>) -> bool {
    element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .any(|ancestor| ancestor.value().name() != "header" && semantic_chrome_element(&ancestor))
}

#[cfg(test)]
#[path = "tests/focus_terms.rs"]
mod tests;
