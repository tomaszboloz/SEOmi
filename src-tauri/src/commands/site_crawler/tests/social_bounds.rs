use super::*;

fn page(body: String) -> Html {
    Html::parse_document(&format!("<html><head>{body}</head></html>"))
}

#[test]
fn social_meta_tags_and_icon_urls_are_bounded_per_page() {
    let base = url::Url::parse("https://example.com/").unwrap();
    let tags = (0..1_000)
        .map(|index| format!(r#"<meta property="og:image" content="/i{index}.png">"#))
        .collect::<String>();
    let icons = (0..1_000)
        .map(|index| format!(r#"<link rel="icon" href="/f{index}.ico">"#))
        .collect::<String>();
    let (favicons, social) = crawl_social_metadata(&page(format!("{tags}{icons}")), &base);
    assert_eq!(social.len(), MAX_SOCIAL_META_TAGS_PER_PAGE);
    assert_eq!(favicons.len(), MAX_FAVICONS_PER_PAGE);
    assert_eq!(favicons[0], "https://example.com/f0.ico");
}

#[test]
fn favicon_metadata_is_bounded_and_keeps_document_order() {
    let base = url::Url::parse("https://example.com/").unwrap();
    let icons = (0..500)
        .map(|index| format!(r#"<link rel="icon" href="/f{index}.png" sizes="32x32">"#))
        .collect::<String>();
    let favicons = crawl_favicon_metadata(&page(icons), &base);
    assert_eq!(favicons.len(), MAX_FAVICONS_PER_PAGE);
    assert_eq!(favicons[0].href, "https://example.com/f0.png");
    assert_eq!(favicons[0].declared_sizes.as_deref(), Some("32x32"));
}

#[test]
fn pages_within_the_bounds_keep_every_declaration() {
    let base = url::Url::parse("https://example.com/").unwrap();
    let document = page(
        r#"<meta property="og:title" content="T"><meta name="twitter:card" content="summary"><link rel="icon" href="/a.ico"><link rel="apple-touch-icon" href="/b.png">"#.into(),
    );
    let (favicons, social) = crawl_social_metadata(&document, &base);
    assert_eq!(favicons.len(), 2);
    assert_eq!(social.len(), 2);
}
