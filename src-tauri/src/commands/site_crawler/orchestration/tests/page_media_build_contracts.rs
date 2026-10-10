use super::super::constants::MAX_SRCSET_CANDIDATES_PER_IMAGE;
use super::page_media_build::{build_crawled_image, BuiltImage};
use scraper::{Html, Selector};
use url::Url;

fn build_fixture(html: &str, src: &str, inline: bool, resolved: Option<&str>) -> BuiltImage {
    let document = Html::parse_fragment(html);
    let selector = Selector::parse("img").unwrap();
    let element = document.select(&selector).next().unwrap();
    let base = Url::parse("https://example.com/assets/page").unwrap();
    let resolved = resolved.map(|value| Url::parse(value).unwrap());
    build_crawled_image(&element, src, resolved.as_ref(), inline, &base)
}

#[test]
fn external_images_keep_attributes_and_only_check_http_srcset_candidates() {
    let built = build_fixture(
        r#"<img alt="Hero" width="640" height="480" loading="LAZY"
            srcset="small.webp 1x, data:image/png;base64,abc 2x, javascript:bad 3x, https://cdn.test/large.webp 4x">"#,
        "photo.WEBP?cache=1",
        false,
        Some("https://example.com/assets/photo.WEBP?cache=1"),
    );
    assert_eq!(
        built.image.src,
        "https://example.com/assets/photo.WEBP?cache=1"
    );
    assert_eq!(built.image.alt.as_deref(), Some("Hero"));
    assert_eq!(built.image.format.as_deref(), Some("webp"));
    assert_eq!(
        (built.image.width, built.image.height),
        (Some(640), Some(480))
    );
    assert_eq!(built.image.dimensions_source.as_deref(), Some("attributes"));
    assert!(built.image.lazy_loaded);
    assert_eq!(built.parsed_srcset_urls.len(), 4);
    assert_eq!(built.image.srcset_resource_checks.len(), 2);
    assert!(built
        .image
        .srcset_resource_checks
        .iter()
        .all(|check| check.url.starts_with("http")));
    assert!(!built.image.srcset_resource_checks_truncated);
}

#[test]
fn inline_dimensions_merge_with_attributes_and_malformed_candidates_are_skipped() {
    let src = "data:image/svg+xml,%3Csvg%20width%3D%2280%22%20height%3D%2240%22%3E%3C/svg%3E";
    let built = build_fixture(
        r#"<img width="bad" height="20" loading="eager"
            srcset="http://[bad 1x, /external.webp 2x, https://cdn.test/ok.webp 3x">"#,
        src,
        true,
        None,
    );
    assert_eq!(built.image.src, src);
    assert_eq!(built.image.format.as_deref(), Some("svg+xml"));
    assert_eq!(
        (built.image.width, built.image.height),
        (Some(80), Some(20))
    );
    assert_eq!(built.image.dimensions_source.as_deref(), Some("mixed"));
    assert!(!built.image.lazy_loaded);
    assert_eq!(built.image.srcset_resource_checks.len(), 2);
    assert!(built.parsed_srcset_urls.contains(&"http://[bad".into()));
}

#[test]
fn srcset_candidate_limit_is_reported_without_dropping_parsed_urls() {
    let srcset = (0..MAX_SRCSET_CANDIDATES_PER_IMAGE + 1)
        .map(|index| format!("image-{index}.webp 1x"))
        .collect::<Vec<_>>()
        .join(", ");
    let html = format!("<img srcset=\"{srcset}\">");
    let built = build_fixture(
        &html,
        "image.webp",
        false,
        Some("https://example.com/image.webp"),
    );
    assert_eq!(
        built.parsed_srcset_urls.len(),
        MAX_SRCSET_CANDIDATES_PER_IMAGE + 1
    );
    assert_eq!(
        built.image.srcset_resource_checks.len(),
        MAX_SRCSET_CANDIDATES_PER_IMAGE
    );
    assert!(built.image.srcset_resource_checks_truncated);
}
