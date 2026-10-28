use super::models::RagSection;
#[path = "rag_metadata.rs"]
mod rag_metadata;
use self::rag_metadata::{
    direct_item_word_counts, flat_text, has_instruction_context, inside_table_or_item,
    table_has_headers, MAX_LIST_ITEMS,
};
use super::semantic_chrome::{has_semantic_content_root, semantic_content_contains};
use super::*;

const MAX_SECTIONS: usize = 40;
const MAX_PARAGRAPHS: usize = 30;
const MAX_PARAGRAPH_CHARS: usize = 1200;

fn record_list_item_counts(section: &mut RagSection, list: &ElementRef<'_>, overflowed: &mut bool) {
    if *overflowed {
        return;
    }
    let Ok(counts) = direct_item_word_counts(list) else {
        section.list_item_word_counts = None;
        *overflowed = true;
        return;
    };
    if counts.is_empty() {
        return;
    }
    let existing = section.list_item_word_counts.as_ref().map_or(0, Vec::len);
    if existing + counts.len() > MAX_LIST_ITEMS {
        section.list_item_word_counts = None;
        *overflowed = true;
        return;
    }
    section
        .list_item_word_counts
        .get_or_insert_with(Vec::new)
        .extend(counts);
}

/// Splits main content into H1-H3 sections for AI/RAG readiness checks.
pub(super) fn extract_rag_sections(document: &Html) -> Vec<RagSection> {
    let has_root = has_semantic_content_root(document);
    let selector = Selector::parse("h1, h2, h3, p, li, dd, blockquote, table, ol, ul, dl")
        .expect("static rag selector valid");
    let mut sections = vec![RagSection::default()];
    let mut list_counts_overflowed = false;
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
                list_counts_overflowed = false;
            }
            continue;
        }
        let section = sections.last_mut().expect("lead section present");
        match name {
            "table" => {
                section.tables = section.tables.saturating_add(1);
                if table_has_headers(&element) {
                    let headers = section.table_headers.get_or_insert(0);
                    *headers = headers.saturating_add(1);
                }
            }
            "ol" => {
                section.ordered_lists = section.ordered_lists.saturating_add(1);
                let instruction = section.ordered_list_instruction.get_or_insert(false);
                *instruction |= has_instruction_context(&element);
            }
            "ul" => {
                section.unordered_lists = section.unordered_lists.saturating_add(1);
                record_list_item_counts(section, &element, &mut list_counts_overflowed);
            }
            "dl" => {
                section.definition_lists = section.definition_lists.saturating_add(1);
                record_list_item_counts(section, &element, &mut list_counts_overflowed);
            }
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
