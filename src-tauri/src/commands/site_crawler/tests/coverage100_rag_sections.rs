use super::super::extract_rag_sections;
use scraper::Html;

#[test]
fn coverage100_nested_paragraphs_are_skipped_but_outer_content_is_kept() {
    let document = Html::parse_document(
        "<body><main><p>outer</p><table><tr><td><p>cell</p></td></tr></table>\
         <ul><li><p>item</p></li></ul></main></body>",
    );
    let sections = extract_rag_sections(&document);
    assert_eq!(sections.len(), 1);
    assert!(sections[0].paragraphs.iter().any(|text| text == "outer"));
    assert!(sections[0].paragraphs.iter().any(|text| text == "item"));
    assert_eq!(sections[0].tables, 1);
}
