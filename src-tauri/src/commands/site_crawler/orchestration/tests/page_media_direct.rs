use super::super::page_media::extract_page_images;
use super::super::page_media_build::build_crawled_image;
use super::*;
use scraper::{Html, Selector};
use url::Url;

#[test]
fn image_extractor_keeps_inline_images_and_registers_scoped_srcset_urls() {
    let mut config = default_crawl_config(None);
    config.crawl_images = true;
    let setup = setup(config);
    let mut state = state();
    let document = Html::parse_document(
        r##"<img src="/hero.webp" srcset="/hero-small.webp 1x, /hero-large.webp 2x">
            <img alt="Inline" src="data:image/png;base64,AA">
            <img alt="Missing source"><img alt="Invalid" src="javascript:void(0)">"##,
    );
    let selector = Selector::parse("img").unwrap();
    let base = Url::parse("https://example.test/base/").unwrap();
    let mut issues = Vec::new();
    let images = extract_page_images(
        &document,
        &base,
        "https://example.test/page",
        &selector,
        &setup,
        &mut state,
        &mut issues,
    );

    assert_eq!(images.len(), 2);
    assert_eq!(images[1].alt.as_deref(), Some("Inline"));
    assert!(issues
        .iter()
        .any(|issue| issue.message == "1 image(s) missing alt text"));
    for url in ["/hero.webp", "/hero-small.webp", "/hero-large.webp"] {
        assert!(state
            .resource_candidates
            .contains_key(&format!("https://example.test{url}")));
    }
}

#[test]
fn image_extractor_caps_stored_images_but_counts_all_missing_alt_values() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    let markup = (0..5_001)
        .map(|_| "<img src=\"data:image/png;base64,AA\">")
        .collect::<String>();
    let document = Html::parse_document(&markup);
    let selector = Selector::parse("img").unwrap();
    let mut issues = Vec::new();
    let images = extract_page_images(
        &document,
        &Url::parse("https://example.test/").unwrap(),
        "https://example.test/page",
        &selector,
        &setup,
        &mut state,
        &mut issues,
    );

    assert_eq!(images.len(), 5_000);
    assert!(issues
        .iter()
        .any(|issue| issue.message == "5001 image(s) missing alt text"));
    assert!(state.resource_candidates.is_empty());
}

#[test]
fn inline_image_without_attributes_uses_intrinsic_dimensions() {
    let document = Html::parse_fragment(
        r#"<img src="data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2240%22%3E%3C/svg%3E">"#,
    );
    let element = document
        .select(&Selector::parse("img").unwrap())
        .next()
        .unwrap();
    let image = build_crawled_image(
        &element,
        element.value().attr("src").unwrap(),
        None,
        true,
        &Url::parse("https://example.test/").unwrap(),
    )
    .image;

    assert_eq!((image.width, image.height), (Some(80), Some(40)));
    assert_eq!(
        image.dimensions_source.as_deref(),
        Some("intrinsic-data-uri")
    );
}
