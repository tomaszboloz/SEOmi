use super::*;

#[test]
fn metadata_extraction_preserves_unicode_lengths_last_declarations_and_other_tags() {
    let doc = Html::parse_document("<title> Ąę title </title><meta name='description' content='first'><meta name='DESCRIPTION' content=' Ąę '><meta name='keywords' content='key'><meta name='robots' content='index'><meta name='viewport' content='width=device-width'><meta charset=' utf-8 '><meta name='author' content='Author'><meta name='generator' content='CMS'><meta name='theme-color' content='#000'><meta property='og:title' content='Social'><meta><link rel='canonical' href='/page'>");
    let base = Url::parse("https://example.com:8443/base").unwrap();
    let meta = extract_meta_tags(&doc, Some(&base));
    assert_eq!(meta.title.as_deref(), Some("Ąę title"));
    assert_eq!(meta.title_length, 8);
    assert_eq!(meta.description.as_deref(), Some("Ąę"));
    assert_eq!(meta.description_length, 2);
    assert_eq!(meta.charset.as_deref(), Some("utf-8"));
    assert_eq!(
        meta.canonical.as_deref(),
        Some("https://example.com:8443/page")
    );
    assert_eq!(meta.other_tags.len(), 1);
    assert_eq!(meta.other_tags[0].property.as_deref(), Some("og:title"));
    assert_eq!(meta.keywords.as_deref(), Some("key"));
    assert_eq!(meta.robots.as_deref(), Some("index"));
    assert_eq!(meta.viewport.as_deref(), Some("width=device-width"));
    assert_eq!(meta.author.as_deref(), Some("Author"));
    assert_eq!(meta.generator.as_deref(), Some("CMS"));
    assert_eq!(meta.theme_color.as_deref(), Some("#000"));
}

#[test]
fn legacy_charset_and_missing_base_metadata_are_observed_without_invented_values() {
    let doc = Html::parse_document("<meta http-equiv='CONTENT-TYPE' content='text/html; charset=windows-1250'><link rel='canonical' href='/relative'>");
    let meta = extract_meta_tags(&doc, None);
    assert_eq!(meta.charset.as_deref(), Some("windows-1250"));
    assert_eq!(meta.canonical.as_deref(), Some("/relative"));
    assert_eq!(meta.title_length, 0);
    assert_eq!(meta.description_length, 0);
    assert!(meta.title.is_none() && meta.description.is_none());
}

#[test]
fn favicon_extraction_deduplicates_evidence_and_distinguishes_empty_or_unknown_types() {
    let doc = Html::parse_document("<link rel='icon' href='/icon.png'><link rel='icon' href='/icon.png'><link rel='apple-touch-icon' href='data:image/png;base64,aaa' sizes=' 180x180 '><link rel='mask-icon' href='/plain' type=' '><link rel='stylesheet' href='/skip.css'><link rel='icon' href=' '><link rel='icon'>");
    let base = Url::parse("https://example.com/path").unwrap();
    let icons = extract_favicons(&doc, Some(&base));
    assert_eq!(icons.len(), 3);
    assert_eq!(icons[0].inferred_format.as_deref(), Some("png"));
    assert_eq!(icons[1].inferred_format.as_deref(), Some("png"));
    assert_eq!(icons[1].declared_sizes.as_deref(), Some("180x180"));
    assert!(icons[2].inferred_format.is_none());
    assert!(icons[2].declared_type.is_none());
}

#[test]
fn discovery_links_keep_language_and_origin_but_remove_credentials_from_root_urls() {
    let doc = Html::parse_document(
        "<link rel='alternate' hreflang=' pl ' href='/pl'><link rel='alternate' hreflang='en'>",
    );
    let base = Url::parse("https://user:secret@example.com:8443/path?q=1#x").unwrap();
    let links = extract_hreflang(&doc, Some(&base));
    assert_eq!(links.len(), 1);
    assert_eq!(links[0].hreflang, "pl");
    let (robots, sitemap) = root_discovery_urls(Some(&base));
    assert_eq!(
        robots.as_deref(),
        Some("https://example.com:8443/robots.txt")
    );
    assert_eq!(
        sitemap.as_deref(),
        Some("https://example.com:8443/sitemap.xml")
    );
    assert_eq!(root_discovery_urls(None), (None, None));
}

#[test]
fn charset_marker_offsets_are_byte_stable_before_unicode_prefixes() {
    for (content, expected) in [("İcharset=", ""), ("İtext/html; CHARSET=utf-8", "utf-8")] {
        let source = format!("<meta http-equiv='content-type' content='{content}'>");
        let parsed = parse_html(&source, "https://example.com").unwrap();
        assert_eq!(parsed.meta_tags.charset.as_deref(), Some(expected));
    }
}

#[test]
fn favicon_declarations_preserve_mime_types_and_missing_data_subtypes() {
    let doc = Html::parse_document("<link rel='icon' href='/icon.ico' type=' image/x-icon '><link rel='icon' href='data:image/;base64,aaa'>");
    let icons = extract_favicons(&doc, None);
    assert_eq!(icons.len(), 2);
    assert_eq!(icons[0].declared_type.as_deref(), Some("image/x-icon"));
    assert_eq!(icons[0].inferred_format.as_deref(), Some("ico"));
    assert!(icons[1].inferred_format.is_none());
}
