use scraper::{ElementRef, Node};

use super::link_section_heading::section_heading;
use super::models::CrawledLink;

/// Words kept on each side of the anchor (issue #70).
const CONTEXT_WORDS: usize = 15;
/// Text nodes inspected per block; a larger block gives no context instead of a slow scan.
const MAX_BLOCK_TEXT_NODES: usize = 400;
const METHOD_DOM: &str = "dom-ancestry";

/// Where a link sits, judged from DOM ancestry only.
/// Fold position (above/below) is NOT claimed here: it needs a render and a viewport.
pub(crate) fn dom_zone(element: &ElementRef<'_>) -> &'static str {
    let mut found = ("unknown", 0u8);
    for ancestor in element.ancestors().filter_map(ElementRef::wrap) {
        let value = ancestor.value();
        let role = value.attr("role").unwrap_or_default().to_ascii_lowercase();
        let tokens: Vec<String> = ["id", "class"]
            .iter()
            .filter_map(|attribute| value.attr(attribute))
            .flat_map(|text| text.split(|c: char| !c.is_ascii_alphanumeric()))
            .map(str::to_ascii_lowercase)
            .collect();
        let has = |words: &[&str]| tokens.iter().any(|t| words.contains(&t.as_str()));
        let (zone, rank) = if matches!(value.name(), "nav" | "header")
            || role == "navigation"
            || role == "banner"
            || has(&["breadcrumb", "breadcrumbs", "navbar", "menu"])
        {
            ("nav_breadcrumb", 4)
        } else if matches!(value.name(), "aside" | "footer")
            || role == "complementary"
            || role == "contentinfo"
            || has(&["sidebar", "footer"])
        {
            ("sidebar_footer", 3)
        } else if has(&["widget"]) {
            ("widget", 2)
        } else if value.name() == "main" || role == "main" {
            ("main", 1)
        } else {
            continue;
        };
        if rank > found.1 {
            found = (zone, rank);
        }
    }
    found.0
}

/// Up to 15 words before and after the anchor inside its nearest block element.
pub(crate) fn context_words(element: &ElementRef<'_>) -> (Option<String>, Option<String>) {
    let Some(block) = element.ancestors().filter_map(ElementRef::wrap).find(|a| {
        matches!(
            a.value().name(),
            "p" | "li" | "td" | "dd" | "blockquote" | "div" | "section" | "article" | "main"
        )
    }) else {
        return (None, None);
    };
    let (mut before, mut after) = (Vec::new(), Vec::new());
    let mut inside = false;
    for (seen, node) in block.descendants().enumerate() {
        if seen > MAX_BLOCK_TEXT_NODES {
            return (None, None);
        }
        let Node::Text(text) = node.value() else {
            continue;
        };
        if node.ancestors().any(|a| a.id() == element.id()) {
            inside = true;
            continue;
        }
        let words = text.split_whitespace().map(str::to_owned);
        if inside {
            after.extend(words)
        } else {
            before.extend(words)
        }
    }
    let start = before.len().saturating_sub(CONTEXT_WORDS);
    let join = |words: &[String]| (!words.is_empty()).then(|| words.join(" "));
    (
        join(&before[start..]),
        join(&after[..after.len().min(CONTEXT_WORDS)]),
    )
}

pub(crate) struct LinkFacts {
    pub target_url: String,
    pub anchor_text: String,
    pub rel: Option<String>,
    pub is_internal: bool,
    pub source_excerpt: Option<String>,
}

/// Builds a link with placement evidence; unchecked target fields start empty.
pub(crate) fn build_link(facts: LinkFacts, element: &ElementRef<'_>) -> CrawledLink {
    let (context_before, context_after) = context_words(element);
    CrawledLink {
        target_url: facts.target_url,
        anchor_text: facts.anchor_text,
        rel: facts.rel,
        is_internal: facts.is_internal,
        source_excerpt: facts.source_excerpt,
        target_http_status: None,
        target_response_time_ms: None,
        target_redirect_url: None,
        target_request_error_kind: None,
        target_checked_at: None,
        zone: Some(dom_zone(element).to_owned()),
        zone_method: Some(METHOD_DOM.to_owned()),
        context_before,
        context_after,
        section_heading: section_heading(element),
    }
}
