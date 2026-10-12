use super::super::page_type_links::mostly_internal_links;
use scraper::Html;

fn links(count: usize, label: &str) -> String {
    (0..count)
        .map(|n| format!("<a href='/p{n}.html'>{label}</a>"))
        .collect()
}

#[test]
fn symbol_only_anchors_without_body_words_are_not_a_listing() {
    let html = format!("<html><body>{}</body></html>", links(4, "&rarr;"));
    let document = Html::parse_document(&html);
    assert!(!mostly_internal_links(&document, "https://example.test/a"));
}

#[test]
fn long_prose_around_few_anchor_words_is_not_a_listing() {
    let prose = "word ".repeat(200);
    let html = format!("<html><body><p>{prose}</p>{}</body></html>", links(4, "go"));
    let document = Html::parse_document(&html);
    assert!(!mostly_internal_links(&document, "https://example.test/a"));
}

#[test]
fn json_ld_with_a_non_textual_type_is_not_a_collection() {
    use super::super::page_type_evidence::is_listing;
    let page = |json: &str| {
        Html::parse_document(&format!(
            r#"<html><body><script type="application/ld+json">{json}</script></body></html>"#
        ))
    };
    let url = "https://example.test/x";
    assert!(!is_listing(&page(r#"{"@type":5}"#), url));
    assert!(is_listing(
        &page(r#"{"@type":["Thing","CollectionPage"]}"#),
        url
    ));
}
