//! Main-content structure counts (#70 `dom_structure`) with the same chrome
//! exclusions and selectors as the SIJA feature extractor (#69).
use super::super::models::{CrawledPageFocus, DomStructure};
use scraper::{ElementRef, Html, Selector};

const CHROME_TAGS: [&str; 8] = [
    "nav", "header", "footer", "aside", "style", "noscript", "template", "script",
];
const CHROME_ROLES: [&str; 3] = ["navigation", "banner", "contentinfo"];

fn in_chrome(element: &ElementRef<'_>) -> bool {
    std::iter::once(*element)
        .chain(element.ancestors().filter_map(ElementRef::wrap))
        .any(|node| {
            let value = node.value();
            CHROME_TAGS.contains(&value.name())
                || value
                    .attr("role")
                    .is_some_and(|role| CHROME_ROLES.contains(&role.trim()))
        })
}

fn count(document: &Html, selector: &str, keep: impl Fn(&ElementRef<'_>) -> bool) -> u32 {
    let Ok(selector) = Selector::parse(selector) else {
        return 0;
    };
    let total = document
        .select(&selector)
        .filter(|element| !in_chrome(element) && keep(element))
        .count();
    u32::try_from(total).unwrap_or(u32::MAX)
}

fn is_interactive(element: &ElementRef<'_>) -> bool {
    let in_form = element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .any(|a| a.value().name() == "form");
    let kind = element.value().attr("type").unwrap_or_default();
    in_form
        && (element.value().name() != "input"
            || !(kind.eq_ignore_ascii_case("hidden") || kind.eq_ignore_ascii_case("submit")))
}

pub(super) fn measure(document: &Html) -> DomStructure {
    DomStructure {
        tables: count(document, "body table", |_| true),
        ordered_lists: count(document, "body ol", |_| true),
        unordered_lists: count(document, "body ul", |_| true),
        interactive_inputs: count(
            document,
            "body input, body select, body textarea",
            is_interactive,
        ),
    }
}

/// Records the counts only for HTML that was read completely; otherwise leaves them absent.
pub(super) fn attach(
    mut focus: CrawledPageFocus,
    document: &Html,
    available: bool,
) -> CrawledPageFocus {
    focus.dom_structure = available.then(|| measure(document));
    focus
}

#[cfg(test)]
#[path = "dom_structure_tests.rs"]
mod tests;
