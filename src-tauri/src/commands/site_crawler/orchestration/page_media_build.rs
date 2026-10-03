use scraper::ElementRef;
use url::Url;

use super::super::{
    constants::MAX_SRCSET_CANDIDATES_PER_IMAGE,
    inline_images::{bounded_inline_image_uri, inline_image_dimensions, inline_image_format},
    models::{CrawledImage, CrawledImageResourceCheck},
    srcset::parse_srcset_urls,
};

pub struct BuiltImage {
    pub image: CrawledImage,
    pub parsed_srcset_urls: Vec<String>,
}

pub fn build_crawled_image(
    element: &ElementRef,
    src: &str,
    resolved: Option<&Url>,
    inline_image: bool,
    final_base: &Url,
) -> BuiltImage {
    let alt = element.value().attr("alt").map(str::to_owned);
    let srcset = element.value().attr("srcset").map(str::to_owned);
    let inline_dimensions = inline_image.then(|| inline_image_dimensions(src)).flatten();
    let attribute_width = element
        .value()
        .attr("width")
        .and_then(|v| v.trim().parse().ok());
    let attribute_height = element
        .value()
        .attr("height")
        .and_then(|v| v.trim().parse().ok());
    let width = attribute_width.or_else(|| inline_dimensions.map(|v| v.0));
    let height = attribute_height.or_else(|| inline_dimensions.map(|v| v.1));
    let dimensions_source = if attribute_width.is_some() && attribute_height.is_some() {
        Some("attributes".to_string())
    } else if inline_dimensions.is_some() {
        Some(
            if attribute_width.is_some() || attribute_height.is_some() {
                "mixed"
            } else {
                "intrinsic-data-uri"
            }
            .to_string(),
        )
    } else {
        None
    };
    let parsed_srcset_urls = srcset.as_deref().map(parse_srcset_urls).unwrap_or_default();
    let srcset_resource_checks = parsed_srcset_urls
        .iter()
        .take(MAX_SRCSET_CANDIDATES_PER_IMAGE)
        .filter_map(|candidate| {
            let r = final_base.join(candidate).ok()?;
            (r.scheme() == "http" || r.scheme() == "https").then(|| CrawledImageResourceCheck {
                url: r.to_string(),
                checked_in_run: false,
                http_status: None,
                content_length: None,
                request_error_kind: None,
            })
        })
        .collect::<Vec<_>>();

    let image = CrawledImage {
        src: resolved
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_else(|| bounded_inline_image_uri(src)),
        alt,
        srcset,
        format: if inline_image {
            inline_image_format(src)
        } else {
            resolved.as_ref().and_then(|u| {
                u.path()
                    .rsplit('.')
                    .next()
                    .filter(|ext| *ext != u.path())
                    .map(|ext| ext.to_ascii_lowercase())
            })
        },
        width,
        height,
        dimensions_source,
        lazy_loaded: element
            .value()
            .attr("loading")
            .is_some_and(|v| v.eq_ignore_ascii_case("lazy")),
        checked_in_run: false,
        http_status: None,
        content_length: None,
        request_error_kind: None,
        srcset_resource_checks,
        srcset_resource_checks_truncated: parsed_srcset_urls.len()
            > MAX_SRCSET_CANDIDATES_PER_IMAGE,
    };

    BuiltImage {
        image,
        parsed_srcset_urls,
    }
}
