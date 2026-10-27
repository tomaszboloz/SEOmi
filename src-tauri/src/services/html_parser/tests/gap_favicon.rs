use crate::services::html_parser::favicons::extract_favicons;
use scraper::Html;

#[test]
fn shortcut_only_rel_counts_as_a_favicon_declaration() {
    let document =
        Html::parse_document(r#"<link rel="shortcut" href="/s.ico"><link rel="x" href="/n.ico">"#);
    let icons = extract_favicons(&document, None);
    assert_eq!(icons.len(), 1);
    assert!(icons[0].href.ends_with("/s.ico"));
}
