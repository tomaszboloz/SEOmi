use super::super::models::CrawledPageFocus;
use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;

const MAX_ELEMENTS: usize = 512;
/// Levels below `<body>` that shape the layout; deeper nodes are article content, not template.
const MAX_DEPTH: usize = 5;
const MAX_VARIABLES: usize = 32;
const MAX_VAR_LEN: usize = 120;

/// Dynamic or decorative subtrees, plus inline phrasing tags whose count follows the text.
const SKIPPED: [&str; 31] = [
    "script", "style", "noscript", "svg", "template", "a", "span", "strong", "em", "b", "i", "u",
    "s", "br", "wbr", "small", "sup", "sub", "code", "abbr", "time", "mark", "img", "picture",
    "source", "cite", "q", "kbd", "var", "bdi", "bdo",
];

fn skipped(name: &str) -> bool {
    SKIPPED.contains(&name)
}

/// Layout skeleton of `el`: each level keeps the sorted set of distinct child skeletons, so pages of one
/// template with a different number or order of paragraphs, list items or cards share a signature (#139),
/// while a different layout (an extra sidebar, form or section type) still differs.
/// A child cut off by the element budget is left out rather than recorded half-explored.
fn skeleton(el: ElementRef, depth: usize, budget: &mut usize) -> String {
    let name = el.value().name();
    if depth >= MAX_DEPTH {
        return name.to_owned();
    }
    let mut children = Vec::new();
    for child in el.children().filter_map(ElementRef::wrap) {
        if skipped(child.value().name()) {
            continue;
        }
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        let shape = skeleton(child, depth + 1, budget);
        if *budget == 0 && child.children().any(|c| ElementRef::wrap(c).is_some()) {
            break;
        }
        children.push(shape);
    }
    children.sort();
    children.dedup();
    if children.is_empty() {
        name.to_owned()
    } else {
        format!("{name}({})", children.join(","))
    }
}

pub(super) fn signature(document: &Html) -> Option<String> {
    let body = document.select(&Selector::parse("body").ok()?).next()?;
    let mut budget = MAX_ELEMENTS - 1;
    Some(skeleton(body, 0, &mut budget))
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
