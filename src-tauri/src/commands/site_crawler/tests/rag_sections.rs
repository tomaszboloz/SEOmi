use super::extract_rag_sections;
use crate::commands::site_crawler::models::RagSection;
use scraper::Html;
use serde_json::json;

fn sections(html: &str) -> Vec<RagSection> {
    extract_rag_sections(&Html::parse_document(html))
}

#[test]
fn splits_by_headings_and_counts_structures() {
    let s = sections(
        "<body><main><p>Lead text.</p><h2>What is CGM?</h2><p>CGM is a sensor.</p>\
         <table><tr><td><p>cell</p></td></tr></table><h3>Steps</h3><ol><li>One</li><li>Two</li></ol>\
         <dl><dt>A</dt><dd>Def</dd></dl></main><footer><p>Footer</p></footer></body>",
    );
    assert_eq!(s.len(), 3);
    assert_eq!(s[0].level, 0);
    assert_eq!(s[0].paragraphs, vec!["Lead text.".to_string()]);
    assert_eq!((s[1].heading.as_str(), s[1].tables), ("What is CGM?", 1));
    assert_eq!(s[1].paragraphs, vec!["CGM is a sensor.".to_string()]);
    assert_eq!((s[2].ordered_lists, s[2].definition_lists), (1, 1));
    assert!(s[2].paragraphs.contains(&"Two".to_string()));
}

#[test]
fn bounds_sections_and_paragraphs() {
    let mut html = String::from("<body><main>");
    for i in 0..60 {
        html.push_str(&format!("<h2>H{i}</h2>"));
    }
    html.push_str("</main></body>");
    assert!(sections(&html).len() <= 41);
    let long = format!("<body><main><p>{}</p></main></body>", "x".repeat(5000));
    assert_eq!(sections(&long)[0].paragraphs[0].chars().count(), 1200);
    assert!(sections("<body></body>").is_empty());
}

#[test]
fn counts_unordered_lists_and_skips_empty_headings() {
    let s = sections("<body><main><h2> </h2><ul><li>a</li></ul></main></body>");
    assert_eq!(s.len(), 1);
    assert_eq!(s[0].unordered_lists, 1);
}

#[test]
fn emits_structural_evidence_for_real_headers_instructions_and_list_items() {
    let s = sections(
        "<body><main><p>Follow these steps:</p><ol><li>First step</li><li>Then wait</li></ol>\
         <table><tr><td>Unheaded</td></tr></table>\
         <table><thead><tr><th>Field</th></tr></thead><tr><td>Value</td></tr></table>\
         <ul><li>short item</li><li>two words</li></ul>\
         <dl><dt>Term</dt><dd>definition text</dd></dl></main></body>",
    );
    assert_eq!(s[0].tables, 2);
    assert_eq!(s[0].table_headers, Some(1));
    assert_eq!(s[0].ordered_list_instruction, Some(true));
    assert_eq!(s[0].list_item_word_counts, Some(vec![2, 2, 2]));
    let wire = serde_json::to_value(&s[0]).unwrap();
    assert_eq!(wire.get("table_headers"), Some(&json!(1)));
    assert_eq!(wire.get("ordered_list_instruction"), Some(&json!(true)));
    assert_eq!(wire.get("list_item_word_counts"), Some(&json!([2, 2, 2])));
}

#[test]
fn preserves_known_absence_without_inventing_list_item_evidence() {
    let s = sections(
        "<body><main><table><tr><td>Value</td></tr></table>\
         <ol><li>First</li></ol></main></body>",
    );
    assert_eq!(s[0].table_headers, None);
    assert_eq!(s[0].ordered_list_instruction, Some(false));
    assert_eq!(s[0].list_item_word_counts, None);
    let wire = serde_json::to_value(&s[0]).unwrap();
    assert!(!wire.as_object().unwrap().contains_key("table_headers"));
    assert_eq!(wire.get("ordered_list_instruction"), Some(&json!(false)));
    assert!(!wire
        .as_object()
        .unwrap()
        .contains_key("list_item_word_counts"));
}

#[test]
fn omits_list_item_evidence_after_the_section_budget_is_exceeded() {
    let mut html = String::from("<body><main><ul>");
    for _ in 0..257 {
        html.push_str("<li>item</li>");
    }
    html.push_str("</ul><ul><li>later short item</li></ul></main></body>");
    let section = &sections(&html)[0];
    assert_eq!(section.list_item_word_counts, None);
    let wire = serde_json::to_value(section).unwrap();
    assert!(!wire
        .as_object()
        .unwrap()
        .contains_key("list_item_word_counts"));
}

#[test]
fn skips_empty_and_overflowing_paragraphs() {
    let mut html = String::from("<body><main><p></p>");
    for index in 0..31 {
        html.push_str(&format!("<p>Paragraph {index}</p>"));
    }
    html.push_str("</main></body>");
    let result = sections(&html);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].paragraphs.len(), 30);
}

#[path = "coverage100_rag_sections.rs"]
mod coverage100_rag_sections;
