use super::*;
use crate::commands::site_crawler::html_source_locator::set_html_finding_source;
use base64::{prelude::BASE64_STANDARD, Engine as _};

fn data_uri(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", BASE64_STANDARD.encode(bytes))
}

#[test]
fn inline_images_reject_payloads_that_do_not_match_their_declared_format() {
    assert!(inline_image_dimensions(&data_uri("image/png", b"short")).is_none());
    let mut fake_png = vec![0u8; 30];
    fake_png[0] = 1;
    assert!(inline_image_dimensions(&data_uri("image/png", &fake_png)).is_none());
    assert!(inline_image_dimensions(&data_uri("image/gif", b"GIF89")).is_none());
    assert!(inline_image_dimensions(&data_uri("image/gif", b"NOTGIF89a\0\0\0\0")).is_none());
    assert_eq!(
        inline_image_dimensions(&data_uri("image/gif", b"GIF87a\x02\x00\x03\x00")),
        Some((2, 3))
    );
}

#[test]
fn full_document_without_body_has_no_semantic_text() {
    assert_eq!(
        fingerprints::semantic_content_text(&Html::parse_fragment("<p>x</p>")),
        ""
    );
    let svg = Html::parse_document("<body><svg><g>hidden label</g></svg><p>visible</p></body>");
    assert_eq!(fingerprints::semantic_content_text(&svg), "visible");
}

#[test]
fn source_excerpts_never_split_multibyte_characters() {
    let mut finding = CrawledHtmlValidationFinding {
        code: "c".into(),
        severity: "warning".into(),
        message: "m".into(),
        element: None,
        attribute: None,
        value: None,
        line: None,
        column: None,
        source_excerpt: None,
    };
    let leading = format!("{}x", "€".repeat(100));
    set_html_finding_source(&mut finding, &leading, 300);
    assert!(finding.source_excerpt.is_some());
    let trailing = format!("x{}", "€".repeat(100));
    set_html_finding_source(&mut finding, &trailing, 1);
    assert!(finding.source_excerpt.is_some());
}

#[test]
fn resource_candidates_at_capacity_still_merge_known_urls() {
    let config = crawl_config_for_test();
    let base = url::Url::parse("https://example.com/page").unwrap();
    let mut candidates = HashMap::new();
    for index in 0..constants::MAX_RESOURCE_DISCOVERY_CANDIDATES {
        let url = format!("https://example.com/filler-{index}.png");
        candidates.insert(
            url.clone(),
            ResourceCandidate {
                source_urls: Vec::new(),
                url,
                resource_type: "image".into(),
            },
        );
    }
    let known = "https://example.com/filler-1.png";
    for href in ["filler-1.png", "brand-new.png"] {
        add_resource_candidate(
            &mut candidates,
            "https://example.com/page",
            &base,
            href,
            "image",
            "example.com",
            &config,
        );
    }
    assert_eq!(
        candidates.len(),
        constants::MAX_RESOURCE_DISCOVERY_CANDIDATES
    );
    assert_eq!(candidates[known].source_urls, ["https://example.com/page"]);
    assert!(!candidates.contains_key("https://example.com/brand-new.png"));
}
