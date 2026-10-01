use super::*;

#[test]
fn crawl_social_metadata_collects_open_graph_and_twitter_tags_only() {
    let document = Html::parse_document(
        r#"<html><head>
              <meta property="og:title" content="Actual title">
              <meta property="og:description" content="Actual description">
              <meta name="twitter:card" content="summary_large_image">
              <meta name="description" content="Not a social-card tag">
            </head></html>"#,
    );
    let base = url::Url::parse("https://example.com/page").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(tags.len(), 3);
    assert_eq!(tags[0].key, "og:title");
    assert_eq!(tags[0].content.as_deref(), Some("Actual title"));
    assert_eq!(tags[2].key, "twitter:card");
}

#[test]
fn crawl_favicon_metadata_preserves_declaration_attributes_and_deduplicates() {
    let document = Html::parse_document(
        r#"<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
              <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
              <link rel="shortcut icon" href="/favicon.ico">
              <link rel="stylesheet" href="/app.css">"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let favicons = crawl_favicon_metadata(&document, &base);

    assert_eq!(favicons.len(), 2);
    assert_eq!(favicons[0].href, "https://example.com/favicon.svg");
    assert_eq!(favicons[0].rel, "icon");
    assert_eq!(favicons[0].declared_type.as_deref(), Some("image/svg+xml"));
    assert_eq!(favicons[0].declared_sizes.as_deref(), Some("any"));
    assert_eq!(favicons[0].inferred_format.as_deref(), Some("svg"));
    assert_eq!(favicons[1].rel, "shortcut icon");
    assert_eq!(favicons[1].inferred_format.as_deref(), Some("ico"));
}

#[test]
fn crawl_frames_resolves_http_targets_and_preserves_frame_attributes() {
    let document = Html::parse_document(
        r#"<iframe src="../embed?id=1" title="Video" name="player" loading="lazy" sandbox="allow-scripts"></iframe>
              <iframe srcdoc="<p>inline</p>"></iframe>
              <iframe src="javascript:alert(1)"></iframe>
              <iframe></iframe>"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let (frames, truncated) = crawl_frames(&document, &base);

    assert!(!truncated);
    assert_eq!(frames.len(), 4);
    assert_eq!(frames[0].src.as_deref(), Some("../embed?id=1"));
    assert_eq!(
        frames[0].resolved_url.as_deref(),
        Some("https://example.com/embed?id=1")
    );
    assert_eq!(frames[0].title.as_deref(), Some("Video"));
    assert_eq!(frames[0].name.as_deref(), Some("player"));
    assert_eq!(frames[0].loading.as_deref(), Some("lazy"));
    assert_eq!(frames[0].sandbox.as_deref(), Some("allow-scripts"));
    assert!(frames[1..].iter().all(|frame| frame.resolved_url.is_none()));
}

#[test]
fn crawl_social_metadata_normalizes_keys_but_preserves_duplicate_declarations() {
    let document = Html::parse_document(
        r#"<meta property="OG:TITLE" content="First"><meta property="og:title" content="Second">"#,
    );
    let base = url::Url::parse("https://example.com/").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(tags.len(), 2);
    assert!(tags.iter().all(|tag| tag.key == "og:title"));
    assert_eq!(tags[0].content.as_deref(), Some("First"));
    assert_eq!(tags[1].content.as_deref(), Some("Second"));
}

#[test]
fn crawl_social_metadata_resolves_declared_social_urls_against_final_url() {
    let document = Html::parse_document(
        r#"<meta property="og:url" content="../canonical"><meta property="og:image" content="/social.png"><meta name="twitter:image" content="images/card.jpg">"#,
    );
    let base = url::Url::parse("https://example.com/folder/page").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(
        tags[0].content.as_deref(),
        Some("https://example.com/canonical")
    );
    assert_eq!(
        tags[1].content.as_deref(),
        Some("https://example.com/social.png")
    );
    assert_eq!(
        tags[2].content.as_deref(),
        Some("https://example.com/folder/images/card.jpg")
    );
}

#[test]
fn crawl_social_metadata_distinguishes_missing_content_from_empty_content() {
    let document = Html::parse_document(
        r#"<meta property="og:title"><meta property="og:description" content="">"#,
    );
    let base = url::Url::parse("https://example.com/").unwrap();

    let (_, tags) = crawl_social_metadata(&document, &base);

    assert_eq!(tags[0].content, None);
    assert_eq!(tags[1].content.as_deref(), Some(""));
}

#[test]
fn crawl_social_metadata_discovers_and_deduplicates_http_favicons() {
    let document = Html::parse_document(
        r#"<link rel="shortcut icon" href="/favicon.ico"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="icons/touch.png"><link rel="icon" href="javascript:alert(1)"><link rel="alternate" href="feed.xml">"#,
    );
    let base = url::Url::parse("https://example.com/articles/page").unwrap();

    let (favicons, _) = crawl_social_metadata(&document, &base);

    assert_eq!(
        favicons,
        vec![
            "https://example.com/favicon.ico",
            "https://example.com/articles/icons/touch.png"
        ]
    );
}
