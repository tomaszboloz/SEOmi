use super::*;

#[test]
fn crawl_social_metadata_creates_unchecked_records_for_declared_image_resources() {
    let document = Html::parse_document(
        r#"<meta property="og:image" content="../share.webp"><meta property="og:image:width" content="1200"><meta name="twitter:image:src" content="https://cdn.example.test/card.png"><meta property="og:title" content="A title">"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    let og_image = tags.iter().find(|tag| tag.key == "og:image").unwrap();
    assert_eq!(
        og_image.content.as_deref(),
        Some("https://example.com/share.webp")
    );
    let check = og_image.resource_check.as_ref().unwrap();
    assert_eq!(check.url, "https://example.com/share.webp");
    assert!(!check.checked_in_run);
    assert_eq!(check.http_status, None);
    let twitter_image = tags
        .iter()
        .find(|tag| tag.key == "twitter:image:src")
        .unwrap();
    assert!(twitter_image.resource_check.is_some());
    let width = tags.iter().find(|tag| tag.key == "og:image:width").unwrap();
    assert!(width.resource_check.is_none());
    let title = tags.iter().find(|tag| tag.key == "og:title").unwrap();
    assert!(title.resource_check.is_none());
}

#[test]
fn optional_social_image_requests_respect_image_enablement_and_crawl_scope() {
    let base = url::Url::parse("https://example.com/articles/page").unwrap();
    let mut config = crawl_config_for_test();
    let mut candidates = HashMap::new();
    add_resource_candidate(
        &mut candidates,
        "https://example.com/articles/page",
        &base,
        "https://example.com/articles/share.png",
        "image",
        "example.com",
        &config,
    );
    assert!(candidates.is_empty());

    config.crawl_images = true;
    add_resource_candidate(
        &mut candidates,
        "https://example.com/articles/page",
        &base,
        "https://example.com/articles/share.png",
        "image",
        "example.com",
        &config,
    );
    add_resource_candidate(
        &mut candidates,
        "https://example.com/articles/page",
        &base,
        "https://cdn.example.net/share.png",
        "image",
        "example.com",
        &config,
    );
    assert_eq!(candidates.len(), 1);
    assert_eq!(
        candidates.values().next().unwrap().url,
        "https://example.com/articles/share.png"
    );
}

#[test]
fn checked_social_resources_keep_http_status_content_type_and_size() {
    let config = crawl_config_for_test();
    let mut checks = vec![
        unchecked_social_resource("https://example.com/favicon.ico"),
        unchecked_social_resource("https://example.com/social.png"),
        unchecked_social_resource("https://example.com/not-checked.png"),
    ];
    let resources = [
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/favicon.ico".into(),
            resource_type: "image".into(),
            http_status: Some(200),
            content_type: Some("image/x-icon".into()),
            content_length: Some(321),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(12),
            request_error_kind: None,
        },
        CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/social.png".into(),
            resource_type: "image".into(),
            http_status: Some(404),
            content_type: Some("text/html".into()),
            content_length: Some(82),
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(34),
            request_error_kind: None,
        },
    ];
    let checked_images = resources
        .iter()
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();

    apply_checked_social_resource_checks(&mut checks, &checked_images, &config);

    assert!(checks[0].checked_in_run);
    assert_eq!(checks[0].http_status, Some(200));
    assert_eq!(checks[0].content_type.as_deref(), Some("image/x-icon"));
    assert_eq!(checks[0].content_length, Some(321));
    assert_eq!(checks[1].http_status, Some(404));
    assert_eq!(checks[1].content_length, Some(82));
    assert!(!checks[2].checked_in_run);
    assert_eq!(checks[2].http_status, None);
}

#[test]
fn crawl_social_metadata_keeps_http_links_but_does_not_resolve_non_http_social_values() {
    let document = Html::parse_document(
        r#"<meta property="og:image" content="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AA==">"#,
    );
    let base = url::Url::parse("https://example.com/").unwrap();

    let (favicons, tags) = crawl_social_metadata(&document, &base);

    assert!(favicons.is_empty());
    assert_eq!(tags[0].content.as_deref(), Some("javascript:alert(1)"));
}
