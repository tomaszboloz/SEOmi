use super::super::resource_apply::{apply_checked_frame_resources, apply_checked_social_resources};
use super::*;

#[test]
fn social_and_frame_checks_copy_only_observed_resource_fields() {
    let config = crawl_config_for_test();
    let mut page = post_processing_page("https://example.com/page");
    page.favicon_resource_checks = vec![CrawledSocialResourceCheck {
        url: "https://example.com/favicon.png".into(),
        checked_in_run: false,
        http_status: None,
        content_type: None,
        content_length: None,
        intrinsic_width: None,
        intrinsic_height: None,
        dimensions_source: None,
        request_error_kind: None,
    }];
    page.social_meta_tags = vec![CrawledSocialMetaTag {
        key: "og:image".into(),
        content: Some("https://example.com/social.png".into()),
        resource_check: Some(CrawledSocialResourceCheck {
            url: "https://example.com/social.png".into(),
            checked_in_run: false,
            http_status: None,
            content_type: None,
            content_length: None,
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            request_error_kind: None,
        }),
    }];
    page.frames = vec![CrawledFrame {
        src: Some("/frame".into()),
        resolved_url: Some("https://example.com/frame".into()),
        title: None,
        name: None,
        loading: None,
        sandbox: None,
        checked_in_run: false,
        http_status: None,
        request_error_kind: None,
    }];
    let resources = vec![
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/favicon.png".into(),
            resource_type: "image".into(),
            http_status: Some(200),
            content_type: Some("image/png".into()),
            content_length: Some(120),
            intrinsic_width: Some(32),
            intrinsic_height: Some(32),
            dimensions_source: Some("intrinsic-http".into()),
            response_time_ms: Some(7),
            request_error_kind: None,
        },
        CrawledResource {
            source_urls: Vec::new(),
            url: "https://example.com/social.png".into(),
            resource_type: "image".into(),
            http_status: Some(404),
            content_type: Some("image/png".into()),
            content_length: None,
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: None,
            request_error_kind: Some("http".into()),
        },
        CrawledResource {
            source_urls: Vec::new(),
            url: "https://example.com/frame".into(),
            resource_type: "frame".into(),
            http_status: Some(204),
            content_type: None,
            content_length: None,
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: None,
            request_error_kind: None,
        },
    ];
    apply_checked_social_resources(std::slice::from_mut(&mut page), &resources, &config);
    apply_checked_frame_resources(std::slice::from_mut(&mut page), &resources, &config);

    let favicon = &page.favicon_resource_checks[0];
    assert!(favicon.checked_in_run);
    assert_eq!(favicon.http_status, Some(200));
    assert_eq!(favicon.intrinsic_width, Some(32));
    let social = page.social_meta_tags[0].resource_check.as_ref().unwrap();
    assert!(social.checked_in_run);
    assert_eq!(social.http_status, Some(404));
    assert_eq!(social.request_error_kind.as_deref(), Some("http"));
    assert!(page.frames[0].checked_in_run);
    assert_eq!(page.frames[0].http_status, Some(204));
}
