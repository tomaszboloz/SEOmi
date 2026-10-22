use super::models::RagSection;
use super::semantic_chrome::{has_semantic_content_root, semantic_content_contains};
use super::*;

const MAX_SECTIONS: usize = 40;
const MAX_PARAGRAPHS: usize = 30;
const MAX_PARAGRAPH_CHARS: usize = 1200;

fn flat_text(element: &ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn inside_table_or_item(element: &ElementRef<'_>) -> bool {
    element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .any(|a| matches!(a.value().name(), "table" | "li"))
}

/// Splits main content into H1-H3 sections for AI/RAG readiness checks.
pub(super) fn extract_rag_sections(document: &Html) -> Vec<RagSection> {
    let has_root = has_semantic_content_root(document);
    let selector = Selector::parse("h1, h2, h3, p, li, dd, blockquote, table, ol, ul, dl")
        .expect("static rag selector valid");
    let mut sections = vec![RagSection::default()];
    for element in document.select(&selector) {
        if !semantic_content_contains(&element, has_root) {
            continue;
        }
        let name = element.value().name();
        if let Some(level) = name.strip_prefix('h').and_then(|n| n.parse::<u8>().ok()) {
            if sections.len() >= MAX_SECTIONS {
                break;
            }
            let heading = flat_text(&element);
            if !heading.is_empty() {
                sections.push(RagSection {
                    heading,
                    level,
                    ..Default::default()
                });
            }
            continue;
        }
        let section = sections.last_mut().expect("lead section present");
        match name {
            "table" => section.tables = section.tables.saturating_add(1),
            "ol" => section.ordered_lists = section.ordered_lists.saturating_add(1),
            "ul" => section.unordered_lists = section.unordered_lists.saturating_add(1),
            "dl" => section.definition_lists = section.definition_lists.saturating_add(1),
            _ => {
                let nested = name == "p" && inside_table_or_item(&element);
                let text = flat_text(&element);
                if nested || text.is_empty() || section.paragraphs.len() >= MAX_PARAGRAPHS {
                    continue;
                }
                section
                    .paragraphs
                    .push(text.chars().take(MAX_PARAGRAPH_CHARS).collect());
            }
        }
    }
    sections.retain(|s| {
        !s.heading.is_empty()
            || !s.paragraphs.is_empty()
            || s.tables + s.ordered_lists + s.definition_lists > 0
    });
    sections
}

#[cfg(test)]
#[path = "tests/rag_sections.rs"]
mod tests;
