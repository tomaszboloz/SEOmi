//! Anchor context of a link (#70 GEM-70-02): words around the anchor inside its block, with evidence.
use scraper::{ElementRef, Node};

use super::link_context_redaction::{is_hidden_text, redact_context_word};

/// Words kept on each side of the anchor (issue #70).
const CONTEXT_WORDS: usize = 15;
/// Text nodes inspected per block; a larger block gives no context instead of a slow scan.
const MAX_BLOCK_TEXT_NODES: usize = 400;

#[derive(Debug, Default, PartialEq)]
pub(crate) struct LinkContext {
    pub before: Option<String>,
    pub after: Option<String>,
    /// True when the block held more than 15 words on at least one side, so the stored text is cut.
    pub truncated: bool,
    /// Number of visible words before the anchor in the block (word offset of the anchor).
    pub anchor_offset: Option<usize>,
}

/// Up to 15 words before and after the anchor inside its nearest block element.
pub(crate) fn link_context(element: &ElementRef<'_>) -> LinkContext {
    let Some(block) = element.ancestors().filter_map(ElementRef::wrap).find(|a| {
        matches!(
            a.value().name(),
            "p" | "li" | "td" | "dd" | "blockquote" | "div" | "section" | "article" | "main"
        )
    }) else {
        return LinkContext::default();
    };
    let (mut before, mut after) = (Vec::new(), Vec::new());
    let mut inside = false;
    for (seen, node) in block.descendants().enumerate() {
        if seen > MAX_BLOCK_TEXT_NODES {
            return LinkContext::default();
        }
        let Node::Text(text) = node.value() else {
            continue;
        };
        if node.ancestors().any(|a| a.id() == element.id()) {
            inside = true;
            continue;
        }
        if is_hidden_text(node.parent().and_then(ElementRef::wrap)) {
            continue;
        }
        let words = text.split_whitespace().map(redact_context_word);
        if inside {
            after.extend(words)
        } else {
            before.extend(words)
        }
    }
    let start = before.len().saturating_sub(CONTEXT_WORDS);
    let join = |words: &[String]| (!words.is_empty()).then(|| words.join(" "));
    LinkContext {
        before: join(&before[start..]),
        after: join(&after[..after.len().min(CONTEXT_WORDS)]),
        truncated: start > 0 || after.len() > CONTEXT_WORDS,
        anchor_offset: Some(before.len()),
    }
}

/// Kept for the redaction and placement tests: the two context strings only.
#[cfg(test)]
pub(crate) fn context_words(element: &ElementRef<'_>) -> (Option<String>, Option<String>) {
    let context = link_context(element);
    (context.before, context.after)
}
