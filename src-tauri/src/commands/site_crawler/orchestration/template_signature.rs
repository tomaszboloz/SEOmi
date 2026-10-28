use super::super::models::CrawledPageFocus;
use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;

const MAX_ELEMENTS: usize = 512;
const MAX_VARIABLES: usize = 32;
const MAX_VAR_LEN: usize = 120;

fn excluded(el: &ElementRef) -> bool {
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
    let body = document.select(&Selector::parse("body").ok()?).next()?;
    let base_depth = body.ancestors().filter_map(ElementRef::wrap).count();
    let tags = body
        .descendants()
        .filter_map(ElementRef::wrap)
        .filter(|el| !excluded(el))
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

fn values(document: &Html, selector: &str) -> Option<Vec<String>> {
    let sel = Selector::parse(selector).ok()?;
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for el in document.select(&sel) {
        let value = el
            .value()
            .attr("content")
            .or_else(|| el.value().attr("data-tas-subtopic"))
            .or_else(|| el.value().attr("data-tas-subtopic-id"))
            .or_else(|| el.value().attr("data-subtopic-id"))
            .or_else(|| el.value().attr("data-template-variable"))
            .or_else(|| el.value().attr("data-template-var"))
            .or_else(|| el.value().attr("data-injected-variable"))
            .or_else(|| el.value().attr("data-injected-var"))
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
            .or_else(|| {
                let text = el.text().collect::<Vec<_>>().join(" ");
                let text = text.trim();
                (!text.is_empty() && text.len() <= MAX_VAR_LEN).then(|| text.to_string())
            });
        if let Some(value) = value {
            if value.len() <= MAX_VAR_LEN && seen.insert(value.clone()) {
                out.push(value);
                if out.len() == MAX_VARIABLES {
                    break;
                }
            }
        }
    }
    (!out.is_empty()).then_some(out)
}

pub(super) fn attach(
    mut focus: CrawledPageFocus,
    document: &Html,
    available: bool,
) -> CrawledPageFocus {
    let selector = "meta[name='template:variable'],meta[name='template-variable'],meta[name='template:var'],meta[name='template-var'],[data-template-variable],[data-template-var],[data-injected-variable],[data-injected-var]";
    let tas_selector = "meta[name='tas:subtopic'],meta[name='tas:subtopic-id'],meta[name='subtopic-id'],meta[name='subtopic'],[data-tas-subtopic],[data-tas-subtopic-id],[data-subtopic-id]";
    focus.template_dom_signature = available.then(|| signature(document)).flatten();
    focus.template_injected_variables = available.then(|| values(document, selector)).flatten();
    focus.tas_subtopic_id = available
        .then(|| values(document, tas_selector).and_then(|values| values.into_iter().next()))
        .flatten();
    focus
}

#[cfg(test)]
#[path = "template_signature_tests.rs"]
mod tests;
