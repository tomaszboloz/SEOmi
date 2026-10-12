use crate::services::html_parser::accessibility::{
    identity_elements, identity_inventory, source_attribute_value, source_tag_matches_selector,
};
use crate::services::html_parser::content::content_metrics;
use crate::services::html_parser::favicons::extract_favicons;
use crate::services::html_parser::technologies::{asset_signals, marker_signals};
use scraper::{Html, Selector};
use url::Url;

const FOCUS: &str = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";

#[test]
fn source_readers_cover_tag_endings_and_focus_selector_edges() {
    assert_eq!(source_attribute_value("<input/", "id"), None);
    assert_eq!(source_attribute_value("<input name", "id"), None);
    assert!(source_tag_matches_selector(
        "<img>",
        "img",
        "img:not([alt])"
    ));
    assert!(!source_tag_matches_selector(
        "<img alt='x'>",
        "img",
        "img:not([alt])"
    ));
    assert!(source_tag_matches_selector("<a href='/next'>", "a", FOCUS));
    assert!(!source_tag_matches_selector("<a>", "a", FOCUS));
}

#[test]
fn identity_limits_keep_unique_examples_and_resolved_references() {
    let mut source = String::from("<main>");
    for index in 0..12 {
        source.push_str(&format!(
            "<span id='item{index}' aria-controls='missing{index}'></span><span id='item{index}'></span>"
        ));
    }
    source.push_str("<span aria-controls='item0 missing-extra'></span></main>");
    let document = Html::parse_document(&source);
    let inventory = identity_inventory(&document);
    assert_eq!(inventory.duplicate_id_count, 12);
    assert_eq!(inventory.duplicate_ids.len(), 10);
    assert_eq!(inventory.unresolved_aria_references.len(), 10);
    let (duplicates, unresolved) = identity_elements(
        &document,
        &source,
        &inventory.ids,
        &inventory.duplicate_id_values,
    );
    assert_eq!(duplicates.len(), 24);
    assert_eq!(unresolved.len(), 13);
}

#[test]
fn focus_ignores_case_insensitive_hidden_inputs_inside_hidden_ancestors() {
    let source = "<main aria-hidden='true'><input type='HIDDEN'><button>ok</button></main>";
    let document = Html::parse_document(source);
    let mut messages = Vec::new();
    let elements =
        super::super::accessibility::focus_elements(&document, source, &mut |code, _, _, _, _| {
            messages.push(code.to_string())
        });
    assert_eq!(elements.len(), 1);
    assert_eq!(messages, vec!["accessibility-focusable-aria-hidden"]);
}

#[test]
fn snippets_and_metrics_cover_empty_and_nonempty_alternatives() {
    let document =
        Html::parse_document("<button id='' data-secret='x' aria-label='Go' disabled></button>");
    let selector = Selector::parse("button").unwrap();
    let snippet = super::super::accessibility::accessibility_element_snippet(
        &document.select(&selector).next().unwrap(),
    );
    assert!(snippet.contains("aria-label=\"Go\""));
    assert!(snippet.contains("disabled"));
    assert!(!snippet.contains("data-secret"));
    let stats = content_metrics(&[], "A sentence.", Some("en"));
    assert_eq!(stats.readability_method, "unavailable");
}

#[test]
fn favicon_and_technology_extractors_skip_invalid_links_and_use_stylesheet_markers() {
    let document = Html::parse_document(
        "<link rel='stylesheet' href='/site.css'><link rel='icon'><link rel='icon' href='/favicon.svg?v=1#x'><link rel='ICON' href='/favicon.svg?v=1#x'>",
    );
    let base = Url::parse("https://example.test/path").unwrap();
    let favicons = extract_favicons(&document, Some(&base));
    assert_eq!(favicons.len(), 2);
    assert!(favicons
        .iter()
        .all(|favicon| favicon.inferred_format.as_deref() == Some("svg")));
    let mut signals = Vec::new();
    asset_signals(
        &Html::parse_document("<link href='/tailwindcss.css'>"),
        "<link href='/tailwindcss.css'>",
        &mut signals,
    );
    assert_eq!(
        signals
            .iter()
            .filter(|signal| signal.name == "Tailwind CSS")
            .count(),
        1
    );
}

#[test]
fn marker_boundaries_do_not_match_embedded_tokens() {
    let document = Html::parse_document("");
    let mut signals = Vec::new();
    marker_signals(&document, "xdata-reactroot data-reactrootX", &mut signals);
    assert!(signals.iter().all(|signal| signal.name != "React"));
    marker_signals(&document, "data-reactroot", &mut signals);
    assert!(signals.iter().any(|signal| signal.name == "React"));
}
