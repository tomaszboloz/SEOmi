use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;

use super::super::models::CrawledPageFocus;

const MAX_ELEMENTS: usize = 512;
const MAX_VARIABLES: usize = 32;
const MAX_VAR_LEN: usize = 120;

fn is_excluded_subtree(el: &ElementRef) -> bool {
    if matches!(
        el.value().name(),
        "script" | "style" | "noscript" | "svg" | "template"
    ) {
        return true;
    }
    el.ancestors()
        .filter_map(ElementRef::wrap)
        .take_while(|a| a.value().name() != "body")
        .any(|a| {
            matches!(
                a.value().name(),
                "script" | "style" | "noscript" | "svg" | "template"
            )
        })
}

pub(super) fn signature(document: &Html) -> Option<String> {
    let selector = Selector::parse("body").ok()?;
    let body = document.select(&selector).next()?;
    let base_depth = body.ancestors().filter_map(ElementRef::wrap).count();
    let tags = body
        .descendants()
        .filter_map(ElementRef::wrap)
        .filter(|el| !is_excluded_subtree(el))
        .take(MAX_ELEMENTS - 1)
        .map(|el| {
            let depth = el
                .ancestors()
                .filter_map(ElementRef::wrap)
                .count()
                .saturating_sub(base_depth);
            format!("{depth}:{}", el.value().name())
        });
    Some(
        std::iter::once("0:body".to_string())
            .chain(tags)
            .collect::<Vec<_>>()
            .join(">"),
    )
}

/// Declared document-level injected variables (from meta/attributes), bounded.
/// Returns None when unavailable or missing.
fn extract_injected_variables(document: &Html) -> Option<Vec<String>> {
    let sel = Selector::parse(
        "meta[name='template:variable'],meta[name='template-variable'],meta[property='template:variable'],\
         meta[name='template:var'],meta[name='template-var'],\
         [data-template-variable],[data-template-var],[data-injected-variable],[data-injected-var]",
    ).ok()?;
    let mut vars = Vec::new();
    let mut seen = HashSet::new();
    for el in document.select(&sel) {
        let candidate = el
            .value()
            .attr("content")
            .or_else(|| el.value().attr("data-template-variable"))
            .or_else(|| el.value().attr("data-template-var"))
            .or_else(|| el.value().attr("data-injected-variable"))
            .or_else(|| el.value().attr("data-injected-var"))
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .or_else(|| {
                let t = el.text().collect::<Vec<_>>().join(" ");
                let trimmed = t.trim();
                (!trimmed.is_empty() && trimmed.len() <= MAX_VAR_LEN).then(|| trimmed.to_string())
            });
        if let Some(val) = candidate {
            if val.len() <= MAX_VAR_LEN && seen.insert(val.clone()) {
                vars.push(val);
                if vars.len() >= MAX_VARIABLES {
                    break;
                }
            }
        }
    }
    (!vars.is_empty()).then_some(vars)
}

/// Declared document-level subtopic hint (from meta/attributes), not computed TAS report identity.
/// Returns None when unavailable or missing.
fn extract_tas_subtopic_id(document: &Html) -> Option<String> {
    let sel = Selector::parse(
        "meta[name='tas:subtopic'],meta[name='tas:subtopic-id'],meta[property='tas:subtopic'],\
         meta[property='tas:subtopic-id'],meta[name='subtopic-id'],meta[name='subtopic'],\
         [data-tas-subtopic],[data-tas-subtopic-id],[data-subtopic-id]",
    )
    .ok()?;
    for el in document.select(&sel) {
        let candidate = el
            .value()
            .attr("content")
            .or_else(|| el.value().attr("data-tas-subtopic"))
            .or_else(|| el.value().attr("data-tas-subtopic-id"))
            .or_else(|| el.value().attr("data-subtopic-id"))
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .or_else(|| {
                let t = el.text().collect::<Vec<_>>().join(" ");
                let trimmed = t.trim();
                (!trimmed.is_empty() && trimmed.len() <= MAX_VAR_LEN).then(|| trimmed.to_string())
            });
        if let Some(val) = candidate {
            if val.len() <= MAX_VAR_LEN {
                return Some(val);
            }
        }
    }
    None
}

pub(super) fn attach(
    mut focus: CrawledPageFocus,
    document: &Html,
    available: bool,
) -> CrawledPageFocus {
    focus.template_dom_signature = available.then(|| signature(document)).flatten();
    focus.template_injected_variables = available
        .then(|| extract_injected_variables(document))
        .flatten();
    focus.tas_subtopic_id = available
        .then(|| extract_tas_subtopic_id(document))
        .flatten();
    focus
}

#[cfg(test)]
#[path = "template_signature_tests.rs"]
mod tests;
