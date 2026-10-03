use super::*;

const SAMPLE_SOCIAL_HTML: &str = r#"
<!DOCTYPE html>
<html>
  <head>
    <title>Default Page Title</title>
    <meta name="description" content="Default meta description">
    <meta property="og:title" content="Open Graph Title">
    <meta property="og:description" content="Open Graph Description">
    <meta property="og:image" content="/images/og-banner.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://example.com/item">
    <meta property="og:site_name" content="ExampleSite">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@example">
  </head>
  <body></body>
</html>
"#;

#[test]
fn test_og_tags_extraction() {
    let res = parse_social_tags(
        SAMPLE_SOCIAL_HTML,
        "https://example.com",
        Some("Default Page Title"),
        Some("Default meta description"),
    );

    assert_eq!(
        res.open_graph.og_title,
        Some("Open Graph Title".to_string())
    );
    assert_eq!(
        res.open_graph.og_description,
        Some("Open Graph Description".to_string())
    );
    assert_eq!(
        res.open_graph.og_image,
        Some("https://example.com/images/og-banner.png".to_string())
    );
    assert_eq!(res.open_graph.og_image_width, Some("1200".to_string()));
    assert_eq!(res.open_graph.og_image_height, Some("630".to_string()));
    assert_eq!(res.open_graph.og_type, Some("website".to_string()));
    assert_eq!(res.open_graph.og_site_name, Some("ExampleSite".to_string()));
}

#[test]
fn test_twitter_card_extraction_and_fallback() {
    let res = parse_social_tags(
        SAMPLE_SOCIAL_HTML,
        "https://example.com",
        Some("Default Page Title"),
        Some("Default meta description"),
    );

    assert_eq!(
        res.twitter_card.twitter_card,
        Some("summary_large_image".to_string())
    );
    assert_eq!(res.twitter_card.twitter_site, Some("@example".to_string()));
    // Twitter title and desc should fallback to OG values when absent
    assert_eq!(
        res.twitter_card.twitter_title,
        Some("Open Graph Title".to_string())
    );
    assert_eq!(
        res.twitter_card.twitter_description,
        Some("Open Graph Description".to_string())
    );
    assert_eq!(
        res.twitter_card.twitter_image,
        Some("https://example.com/images/og-banner.png".to_string())
    );
}

#[test]
fn test_social_fallback_to_page_meta_when_no_og() {
    let html_no_social = "<html><head><title>Fallback Title</title></head></html>";
    let res = parse_social_tags(
        html_no_social,
        "https://example.com",
        Some("Fallback Title"),
        Some("Fallback Description"),
    );

    assert_eq!(res.open_graph.og_title, Some("Fallback Title".to_string()));
    assert_eq!(
        res.open_graph.og_description,
        Some("Fallback Description".to_string())
    );
    assert_eq!(
        res.twitter_card.twitter_title,
        Some("Fallback Title".to_string())
    );
}

#[test]
fn test_relative_og_url_resolution() {
    let html = r#"<meta property="og:url" content="/relative-path">"#;
    let res = parse_social_tags(html, "https://example.com/sub/", None, None);
    assert_eq!(
        res.open_graph.og_url,
        Some("https://example.com/relative-path".to_string())
    );
}

#[test]
fn test_empty_social_tags_handled() {
    let html = "<html><body>No meta here</body></html>";
    let res = parse_social_tags(html, "https://example.com", None, None);
    assert!(res.open_graph.og_title.is_none());
    assert!(res.open_graph.all_tags.is_empty());
    assert!(res.twitter_card.all_tags.is_empty());
}
