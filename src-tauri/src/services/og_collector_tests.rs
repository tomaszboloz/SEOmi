use super::{collect_social_meta, resolve_url};
use url::Url;

#[test]
fn contract_social_meta_keeps_raw_attributes_and_separate_namespace_precedence() {
    let meta = collect_social_meta(
        r#"<meta property=" OG:TITLE " name="twitter:title" content="  Shared &amp; title  ">
        <meta property="og:type" content="article"><meta property="og:site_name" content="SEOmi">
        <meta property="og:image:url" content="../first.webp">
        <meta property="og:image" content="/second.webp">
        <meta name="twitter:image:src" content="//cdn.test/first.webp">
        <meta name="twitter:image" content="/second.webp">
        <meta property="og:custom" content="preserved">
        <meta name="unrelated" content="ignored">"#,
        "https://example.test/articles/page",
    );
    assert_eq!(meta.og_title.as_deref(), Some("Shared & title"));
    assert_eq!(meta.twitter_title.as_deref(), Some("Shared & title"));
    assert_eq!(meta.og_type.as_deref(), Some("article"));
    assert_eq!(meta.og_site_name.as_deref(), Some("SEOmi"));
    assert_eq!(
        meta.og_image.as_deref(),
        Some("https://example.test/first.webp")
    );
    assert_eq!(
        meta.twitter_image.as_deref(),
        Some("https://cdn.test/first.webp")
    );
    assert_eq!(meta.og_tags.len(), 6);
    assert_eq!(meta.twitter_tags.len(), 3);
    assert_eq!(meta.og_tags[0].property.as_deref(), Some("OG:TITLE"));
    assert_eq!(meta.og_tags[0].name.as_deref(), Some("twitter:title"));
    assert_eq!(meta.og_tags[0].content, "Shared & title");
    assert_eq!(meta.og_tags.last().unwrap().content, "preserved");
}

#[test]
fn contract_social_meta_invalid_base_preserves_urls_and_missing_fields_stay_absent() {
    let meta = collect_social_meta(
        r#"<meta property="og:image" content=" /relative.webp ">
        <meta property="og:url" content="./article">
        <meta name="twitter:image" content="//cdn.test/photo.webp">"#,
        "invalid base",
    );
    assert_eq!(meta.og_image.as_deref(), Some("/relative.webp"));
    assert_eq!(meta.og_url.as_deref(), Some("./article"));
    assert_eq!(meta.twitter_image.as_deref(), Some("//cdn.test/photo.webp"));
    assert!(meta.og_title.is_none() && meta.twitter_title.is_none());
    let empty = collect_social_meta("<meta charset='utf-8'>", "https://example.test");
    assert!(empty.og_tags.is_empty() && empty.twitter_tags.is_empty());
    assert!(empty.og_image.is_none() && empty.twitter_image.is_none());
}

#[test]
fn resolve_url_uses_base_join_and_preserves_unjoinable_values() {
    let base = Url::parse("https://example.com/articles/").unwrap();
    assert_eq!(
        resolve_url("/cover.png", Some(&base)),
        "https://example.com/cover.png"
    );
    assert_eq!(resolve_url("path", None), "path");
    assert_eq!(
        resolve_url("http://[invalid", Some(&base)),
        "http://[invalid"
    );
}

#[test]
fn collects_case_insensitive_social_tags_and_preserves_first_images() {
    let html = r#"
        <meta content="">
        <meta name="og:title" content="Named OG">
        <meta property="OG:description" content="Description">
        <meta property="og:image" content="/first.png">
        <meta property="og:image:url" content="/second.png">
        <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
        <meta name="og:locale" content="pl_PL"><meta property="og:unknown" content="ignored">
        <meta property="og:url" content="/article">
        <meta name="twitter:title" content="Twitter title">
        <meta property="twitter:description" content="Twitter description">
        <meta name="twitter:image" content="/twitter-first.png">
        <meta property="twitter:image:src" content="/twitter-second.png">
        <meta name="twitter:card" content="summary_large_image">
        <meta property="twitter:site" content="@site"><meta name="twitter:creator" content="@author">
        <meta name="twitter:unknown" content="ignored">
    "#;
    let meta = collect_social_meta(html, "https://example.com/articles/page");

    assert_eq!(meta.og_title.as_deref(), Some("Named OG"));
    assert_eq!(meta.og_description.as_deref(), Some("Description"));
    assert_eq!(
        meta.og_image.as_deref(),
        Some("https://example.com/first.png")
    );
    assert_eq!(meta.og_image_width.as_deref(), Some("1200"));
    assert_eq!(meta.og_image_height.as_deref(), Some("630"));
    assert_eq!(meta.og_url.as_deref(), Some("https://example.com/article"));
    assert_eq!(
        meta.twitter_image.as_deref(),
        Some("https://example.com/twitter-first.png")
    );
    assert_eq!(
        meta.twitter_description.as_deref(),
        Some("Twitter description")
    );
    assert_eq!(meta.og_tags.len(), 9);
    assert_eq!(meta.twitter_tags.len(), 8);
}
