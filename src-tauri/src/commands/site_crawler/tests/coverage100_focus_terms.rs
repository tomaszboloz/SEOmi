use super::super::extract_page_focus;
use crate::commands::site_crawler::focus_counter::{FocusCounter, STRONG_ZONE_WEIGHT};
use scraper::Html;

#[test]
fn coverage100_counter_keeps_repeated_phrases_and_falls_back_to_folded_keys() {
    let mut counter = FocusCounter::new(Some("en"));
    counter.observe("Rare phrase", STRONG_ZONE_WEIGHT, false);
    counter.observe("Alpha beta alpha beta", 1.0, true);
    let terms = counter.into_terms();

    let rare = terms.iter().find(|term| term.term == "rare").unwrap();
    assert_eq!((rare.surface.as_str(), rare.count), ("rare", 0));
    let repeated = terms.iter().find(|term| term.term == "alpha beta").unwrap();
    assert_eq!(repeated.count, 2);
    assert_eq!(repeated.surface, "alpha beta");
}

#[test]
fn coverage100_focus_distinguishes_body_heading_and_hidden_ancestors() {
    let document = Html::parse_document(
        "<body><header><h3>Header label</h3></header><nav><h3>Menu label</h3></nav>\
         <main><h1>Main heading</h1><h2></h2><p>Body term.</p><img alt='main image'>\
         <form><h3>Form label</h3></form></main></body>",
    );
    let page = extract_page_focus(&document, Some("en"), None, None);

    assert!(page
        .heading_texts
        .h3
        .iter()
        .any(|text| text == "Header label"));
    assert!(!page
        .heading_texts
        .h3
        .iter()
        .any(|text| text == "Menu label"));
    assert!(!page
        .heading_texts
        .h3
        .iter()
        .any(|text| text == "Form label"));
    assert!(page.focus_terms.iter().any(|term| term.term == "image"));
}
