use super::super::page_type_links::mostly_internal_links;
use scraper::Html;

#[test]
fn mostly_internal_links_empty_href_and_invalid_target_edges() {
    let html = r#"<!DOCTYPE html>
<html>
<body>
    <a href="">Empty</a>
    <a href="   ">Whitespace</a>
    <a href="http://:80">Invalid Port</a>
    <a href="mailto:test@example.test">Mail</a>
    <a href="/one.html">First internal listing page</a>
    <a href="/two.php">Second internal listing page</a>
    <a href="/three.htm">Third internal listing page</a>
    <a href="/four/">Fourth internal listing page</a>
</body>
</html>"#;
    let document = Html::parse_document(html);
    assert!(mostly_internal_links(
        &document,
        "https://example.test/archive"
    ));
}

#[test]
fn mostly_internal_links_invalid_page_url_and_missing_body() {
    let document = Html::parse_document("<html><body><a href='/a'>A</a></body></html>");
    assert!(!mostly_internal_links(&document, "invalid-url"));

    let no_body = Html::parse_document("<html><head><title>No body</title></head></html>");
    assert!(!mostly_internal_links(
        &no_body,
        "https://example.test/archive"
    ));
}
