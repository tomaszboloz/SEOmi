use super::super::page_media_build::build_crawled_image;
use scraper::{Html, Selector};
use url::Url;

const PNG: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

fn source_of(attributes: &str) -> (Option<String>, Option<usize>, Option<usize>) {
    let document = Html::parse_fragment(&format!("<img src=\"{PNG}\" {attributes}>"));
    let selector = Selector::parse("img").unwrap();
    let element = document.select(&selector).next().unwrap();
    let base = Url::parse("https://example.test/").unwrap();
    let built = build_crawled_image(&element, PNG, None, true, &base).image;
    (built.dimensions_source, built.width, built.height)
}

#[test]
fn dimension_source_distinguishes_attributes_mixed_and_intrinsic_data() {
    assert_eq!(
        source_of(""),
        (Some("intrinsic-data-uri".into()), Some(1), Some(1))
    );
    assert_eq!(
        source_of("width=\"5\""),
        (Some("mixed".into()), Some(5), Some(1))
    );
    assert_eq!(
        source_of("height=\"7\""),
        (Some("mixed".into()), Some(1), Some(7))
    );
    assert_eq!(
        source_of("width=\"5\" height=\"7\""),
        (Some("attributes".into()), Some(5), Some(7))
    );
}
