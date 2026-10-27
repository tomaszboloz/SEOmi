use super::models::ContentSection;
use super::semantic_chrome::{has_semantic_content_root, semantic_content_contains};
use super::*;

const MAX_SECTIONS: usize = 24;
const MAX_SECTION_CHARS: usize = 1000;
const MAX_HEADING_CHARS: usize = 160;
const MIN_SECTION_WORDS: u32 = 8;

fn heading_level(name: &str) -> Option<u8> {
    match name {
        "h1" => Some(1),
        "h2" => Some(2),
        "h3" => Some(3),
        _ => None,
    }
}

fn hidden_tag(name: &str) -> bool {
    matches!(name, "script" | "style" | "noscript" | "svg" | "template")
}

fn squeeze(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn close(sections: &mut Vec<ContentSection>, current: ContentSection) {
    if current.words >= MIN_SECTION_WORDS && sections.len() < MAX_SECTIONS {
        sections.push(current);
    }
}

fn append(section: &mut ContentSection, text: &str) {
    let clean = squeeze(text);
    section.words = section.words.saturating_add(clean.split_whitespace().count() as u32);
    let used = section.text.chars().count();
    if clean.is_empty() || used >= MAX_SECTION_CHARS {
        return;
    }
    if !section.text.is_empty() {
        section.text.push(' ');
    }
    let room = MAX_SECTION_CHARS - used;
    section.text.extend(clean.chars().take(room));
}

/// Main-content text split at H1-H3, with table and list counts per block.
pub(super) fn extract_content_sections(document: &Html) -> Vec<ContentSection> {
    let body_selector = Selector::parse("body").expect("static body selector valid");
    let Some(body) = document.select(&body_selector).next() else {
        return Vec::new();
    };
    let has_root = has_semantic_content_root(document);
    let mut sections = Vec::new();
    let mut current = ContentSection::default();
    for node in body.descendants() {
        match node.value() {
            Node::Element(element) => {
                let Some(reference) = ElementRef::wrap(node) else { continue };
                if !semantic_content_contains(&reference, has_root) {
                    continue;
                }
                if let Some(level) = heading_level(element.name()) {
                    close(&mut sections, std::mem::take(&mut current));
                    current.level = level;
                    current.heading = squeeze(&reference.text().collect::<Vec<_>>().join(" "))
                        .chars()
                        .take(MAX_HEADING_CHARS)
                        .collect();
                } else if element.name() == "table" {
                    current.tables += 1;
                } else if matches!(element.name(), "ol" | "ul" | "dl") {
                    current.lists += 1;
                }
            }
            Node::Text(value) => {
                let Some(parent) = node.parent().and_then(ElementRef::wrap) else { continue };
                if !semantic_content_contains(&parent, has_root) {
                    continue;
                }
                let skipped = parent
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .chain(std::iter::once(parent))
                    .any(|item| hidden_tag(item.value().name()) || heading_level(item.value().name()).is_some());
                if !skipped {
                    append(&mut current, value);
                }
            }
            _ => {}
        }
    }
    close(&mut sections, current);
    sections
}

#[cfg(test)]
#[path = "tests/content_sections.rs"]
mod tests;
