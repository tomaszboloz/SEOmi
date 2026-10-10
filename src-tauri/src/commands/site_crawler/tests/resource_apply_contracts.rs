use super::*;

fn image(src: &str, width: Option<usize>, height: Option<usize>) -> CrawledImage {
    CrawledImage {
        src: src.into(),
        alt: None,
        srcset: None,
        format: Some("webp".into()),
        width,
        height,
        dimensions_source: width.zip(height).map(|_| "attributes".into()),
        lazy_loaded: false,
        checked_in_run: false,
        http_status: None,
        content_length: None,
        request_error_kind: None,
        srcset_resource_checks: Vec::new(),
        srcset_resource_checks_truncated: false,
    }
}

fn resource(url: &str, resource_type: &str, width: Option<usize>) -> CrawledResource {
    CrawledResource {
        source_urls: Vec::new(),
        url: url.into(),
        resource_type: resource_type.into(),
        http_status: Some(200),
        content_type: Some("image/webp".into()),
        content_length: Some(128),
        intrinsic_width: width,
        intrinsic_height: width.map(|value| value / 2),
        dimensions_source: width.map(|_| "intrinsic-http".into()),
        response_time_ms: Some(3),
        request_error_kind: Some("none".into()),
    }
}

fn social_check(url: &str) -> CrawledSocialResourceCheck {
    CrawledSocialResourceCheck {
        url: url.into(),
        checked_in_run: false,
        http_status: None,
        content_type: None,
        content_length: None,
        intrinsic_width: None,
        intrinsic_height: None,
        dimensions_source: None,
        request_error_kind: None,
    }
}

fn frame(resolved_url: Option<&str>) -> CrawledFrame {
    CrawledFrame {
        src: None,
        resolved_url: resolved_url.map(str::to_owned),
        title: None,
        name: None,
        loading: None,
        sandbox: None,
        checked_in_run: false,
        http_status: None,
        request_error_kind: None,
    }
}

#[test]
fn image_application_preserves_attributes_and_marks_mixed_dimensions() {
    let config = crawl_config_for_test();
    let mut images = vec![
        image("https://example.com/left.webp", Some(640), None),
        image("https://example.com/right.webp", None, Some(200)),
        image("https://example.com/complete.webp", Some(640), Some(480)),
        image("https://example.com/unknown.webp", None, None),
        image("not a URL", None, None),
    ];
    images[0].srcset_resource_checks = vec![
        CrawledImageResourceCheck {
            url: "%%%".into(),
            checked_in_run: false,
            http_status: None,
            content_length: None,
            request_error_kind: None,
        },
        CrawledImageResourceCheck {
            url: "https://example.com/left-2.webp?track=1".into(),
            checked_in_run: false,
            http_status: None,
            content_length: None,
            request_error_kind: None,
        },
    ];
    let resources = vec![
        resource("https://example.com/left.webp", "image", Some(800)),
        resource("https://example.com/right.webp", "image", Some(400)),
        resource("https://example.com/complete.webp", "image", Some(900)),
        resource("https://example.com/unknown.webp", "image", Some(320)),
        resource("https://example.com/left-2.webp", "image", None),
        resource("https://example.com/ignored.webp", "script", Some(10)),
    ];
    apply_checked_image_resources(&mut images, &resources, &config);

    assert_eq!((images[0].width, images[0].height), (Some(640), Some(400)));
    assert_eq!(images[0].dimensions_source.as_deref(), Some("mixed"));
    assert_eq!((images[1].width, images[1].height), (Some(400), Some(200)));
    assert_eq!(images[1].dimensions_source.as_deref(), Some("mixed"));
    assert_eq!(images[2].dimensions_source.as_deref(), Some("attributes"));
    assert_eq!(
        images[3].dimensions_source.as_deref(),
        Some("intrinsic-http")
    );
    assert!(images[0].srcset_resource_checks[1].checked_in_run);
    assert!(!images[0].srcset_resource_checks[0].checked_in_run);
    assert!(!images[4].checked_in_run);
}

#[test]
fn social_and_frame_application_skips_missing_invalid_and_unmatched_urls() {
    let config = crawl_config_for_test();
    let mut page = post_processing_page("https://example.com/page");
    page.favicon_resource_checks = vec![social_check("invalid favicon")];
    page.social_meta_tags = vec![
        CrawledSocialMetaTag {
            key: "og:image".into(),
            content: None,
            resource_check: None,
        },
        CrawledSocialMetaTag {
            key: "og:image:secure_url".into(),
            content: None,
            resource_check: Some(social_check("invalid social")),
        },
    ];
    page.frames = vec![frame(None), frame(Some("invalid frame"))];
    apply_checked_social_resources(std::slice::from_mut(&mut page), &[], &config);
    apply_checked_frame_resources(std::slice::from_mut(&mut page), &[], &config);
    assert!(!page.favicon_resource_checks[0].checked_in_run);
    assert!(page.social_meta_tags[0].resource_check.is_none());
    assert!(!page.frames.iter().any(|frame| frame.checked_in_run));
}
