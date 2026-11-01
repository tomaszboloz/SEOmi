use scraper::ElementRef;

use super::link_context::link_context;
use super::link_section_heading::section_heading;
use super::models::CrawledLink;

const METHOD_DOM: &str = "dom-ancestry";
const METHOD_RENDERED: &str = "rendered-viewport";

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

pub(crate) struct LinkFacts {
    pub target_url: String,
    pub anchor_text: String,
    pub rel: Option<String>,
    pub is_internal: bool,
    pub source_excerpt: Option<String>,
    /// Trust the `data-seomi-fold` mark only on pages the crawler rendered itself.
    pub rendered: bool,
}

/// `WIDTHxHEIGHT` of the rendered viewport, e.g. `1280x800`; anything else is ignored (#70 GEM-70-03).
fn viewport_mark<'a>(element: &ElementRef<'a>) -> Option<&'a str> {
    let value = element.value().attr("data-seomi-viewport")?;
    let (width, height) = value.split_once('x')?;
    let valid =
        |part: &str| (1..=5).contains(&part.len()) && part.bytes().all(|b| b.is_ascii_digit());
    (valid(width) && valid(height)).then_some(value)
}

/// Main-content links get their fold position (and viewport size, when recorded) from the render mark (#70).
fn placed_zone(element: &ElementRef<'_>, rendered: bool) -> (&'static str, String) {
    let zone = dom_zone(element);
    let mark = element.value().attr("data-seomi-fold");
    let method = || match viewport_mark(element) {
        Some(size) => format!("{METHOD_RENDERED}:{size}"),
        None => METHOD_RENDERED.to_owned(),
    };
    match (zone, rendered, mark) {
        ("main", true, Some("above")) => ("above_fold", method()),
        ("main", true, Some("below")) => ("below_fold", method()),
        _ => (zone, METHOD_DOM.to_owned()),
    }
}

/// Builds a link with placement evidence; unchecked target fields start empty.
pub(crate) fn build_link(facts: LinkFacts, element: &ElementRef<'_>) -> CrawledLink {
    let context = link_context(element);
    let (zone, zone_method) = placed_zone(element, facts.rendered);
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
        zone: Some(zone.to_owned()),
        zone_method: Some(zone_method),
        context_before: context.before,
        context_after: context.after,
        context_truncated: context.truncated,
        context_anchor_offset: context.anchor_offset,
        section_heading: section_heading(element),
    }
}
