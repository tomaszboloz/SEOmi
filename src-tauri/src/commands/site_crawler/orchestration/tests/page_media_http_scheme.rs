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

#[test]
fn srcset_candidates_with_non_http_schemes_are_not_scheduled_for_checks() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    let document = Html::parse_document(
        r#"<img alt="Set" src="/s.png" srcset="ftp://example.test/a.png 1x, /b.png 2x">"#,
    );
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
    assert_eq!(images[0].srcset_resource_checks.len(), 1);
    assert_eq!(
        images[0].srcset_resource_checks[0].url,
        "http://example.test/b.png"
    );
}
