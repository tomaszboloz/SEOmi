use super::super::page_media::extract_page_images;
use super::*;
use scraper::{Html, Selector};
use url::Url;

#[test]
fn image_extractor_resolves_plain_http_sources() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    let document = Html::parse_document(r#"<img alt="Plain" src="/plain.png">"#);
    let selector = Selector::parse("img").unwrap();
    let base = Url::parse("http://example.test/").unwrap();
    let mut issues = Vec::new();
    let images = extract_page_images(
        &document,
        &base,
        "http://example.test/page",
        &selector,
        &setup,
        &mut state,
        &mut issues,
    );
    assert_eq!(images.len(), 1);
    assert!(issues.is_empty());
}
