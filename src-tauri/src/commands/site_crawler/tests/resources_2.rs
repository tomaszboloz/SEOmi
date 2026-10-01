use super::*;

#[test]
fn image_inventory_uses_only_matching_resource_responses_and_keeps_unknowns_unknown() {
    let config = crawl_config_for_test();
    let mut images = vec![
        CrawledImage {
            src: "https://example.com/photo.webp?version=2".into(),
            alt: Some("Photo".into()),
            srcset: None,
            format: Some("webp".into()),
            width: Some(640),
            height: Some(480),
            dimensions_source: Some("attributes".into()),
            lazy_loaded: false,
            checked_in_run: false,
            http_status: None,
            content_length: None,
            request_error_kind: None,
            srcset_resource_checks: vec![
                CrawledImageResourceCheck {
                    url: "https://example.com/responsive.webp?width=2".into(),
                    checked_in_run: false,
                    http_status: None,
                    content_length: None,
                    request_error_kind: None,
                },
                CrawledImageResourceCheck {
                    url: "https://outside.example/responsive.webp".into(),
                    checked_in_run: false,
                    http_status: None,
                    content_length: None,
                    request_error_kind: None,
                },
            ],
            srcset_resource_checks_truncated: false,
        },
        CrawledImage {
            src: "https://example.com/not-requested.webp".into(),
            alt: None,
            srcset: None,
            format: Some("webp".into()),
            width: None,
            height: None,
            dimensions_source: None,
            lazy_loaded: true,
            checked_in_run: false,
            http_status: None,
            content_length: None,
            request_error_kind: None,
            srcset_resource_checks: Vec::new(),
            srcset_resource_checks_truncated: false,
        },
    ];
    let resources = [
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/photo.webp".into(),
            resource_type: "image".into(),
            http_status: Some(404),
            content_type: Some("image/webp".into()),
            content_length: Some(1234),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(42),
            request_error_kind: None,
        },
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/responsive.webp".into(),
            resource_type: "image".into(),
            http_status: Some(200),
            content_type: Some("image/webp".into()),
            content_length: Some(2048),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(63),
            request_error_kind: None,
        },
    ];

    apply_checked_image_resources(&mut images, &resources, &config);

    assert!(images[0].checked_in_run);
    assert_eq!(images[0].http_status, Some(404));
    assert_eq!(images[0].content_length, Some(1234));
    assert!(images[0].srcset_resource_checks[0].checked_in_run);
    assert_eq!(images[0].srcset_resource_checks[0].http_status, Some(200));
    assert_eq!(
        images[0].srcset_resource_checks[0].content_length,
        Some(2048)
    );
    assert!(!images[0].srcset_resource_checks[1].checked_in_run);
    assert!(!images[1].checked_in_run);
    assert_eq!(images[1].http_status, None);
    assert_eq!(images[1].content_length, None);

    let fetched_dimensions = [CrawledResource {
        source_urls: vec!["https://example.com/page".into()],
        url: "https://example.com/not-requested.webp".into(),
        resource_type: "image".into(),
        http_status: Some(200),
        content_type: Some("image/webp".into()),
        content_length: Some(800),
        intrinsic_width: Some(320),
        intrinsic_height: Some(180),
        dimensions_source: Some("intrinsic-http".into()),
        response_time_ms: Some(11),
        request_error_kind: None,
    }];
    apply_checked_image_resources(&mut images, &fetched_dimensions, &config);
    assert_eq!(images[1].width, Some(320));
    assert_eq!(images[1].height, Some(180));
    assert_eq!(
        images[1].dimensions_source.as_deref(),
        Some("intrinsic-http")
    );
}
