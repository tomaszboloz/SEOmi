use super::*;

#[test]
fn public_parser_combines_independent_document_contracts() {
    let html = r#"<!doctype html><html lang="pl"><head>
    <title>Artykuł testowy</title><meta name="generator" content="WordPress 6.8">
    <link rel="canonical" href="/article"><link rel="icon" href="/icon.png">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Artykuł"}</script>
    </head><body><nav>navigationword</nav><main><h1>Treść artykułu</h1>
    <p>To jest widoczna treść strony z opisem przykładu.</p><span aria-hidden="true">secretword</span>
    <input type="text" name="email" value="must-not-appear-in-evidence"></main></body></html>"#;
    let parsed = parse_html(html, "https://example.com/base/").unwrap();
    assert_eq!(parsed.meta_tags.title.as_deref(), Some("Artykuł testowy"));
    assert_eq!(
        parsed.meta_tags.canonical.as_deref(),
        Some("https://example.com/article")
    );
    assert_eq!(
        parsed.accessibility.document_language.as_deref(),
        Some("pl")
    );
    assert!(parsed.content_stats.body_text.contains("widoczna treść"));
    assert!(!parsed.content_stats.body_text.contains("secretword"));
    assert!(!parsed.content_stats.body_text.contains("navigationword"));
    assert_eq!(parsed.structured_data.len(), 1);
    assert!(!parsed.accessibility.findings.is_empty());
    assert!(!serde_json::to_string(&parsed.accessibility)
        .unwrap()
        .contains("must-not-appear-in-evidence"));
}

#[test]
fn test_title_and_description_extraction() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(
        parsed.meta_tags.title,
        Some("Fast SEO Auditor for Developers | SEOmi".to_string())
    );
    assert_eq!(parsed.meta_tags.title_length, 39);
    assert_eq!(
        parsed.meta_tags.description,
        Some("A blazingly fast native desktop SEO tool built with Rust and React.".to_string())
    );
    assert!(parsed.meta_tags.description_length > 0);
}

#[test]
fn test_canonical_and_favicon_resolution() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(
        parsed.meta_tags.canonical,
        Some("https://example.com/seomi".to_string())
    );
    assert_eq!(
        parsed.technical.favicon,
        Some("https://example.com/assets/favicon.ico".to_string())
    );
    assert_eq!(parsed.technical.favicons.len(), 1);
}

#[test]
fn collects_all_declared_favicon_variants_without_fetching_them() {
    let parsed = parse_html(
        "<html><head><link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\" sizes=\"any\"><link rel=\"apple-touch-icon\" href=\"/apple.png\" sizes=\"180x180\"></head><body></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.technical.favicons.len(), 2);
    assert!(parsed
        .technical
        .favicons
        .iter()
        .any(|item| item.href == "https://example.com/favicon.svg"
            && item.declared_type.as_deref() == Some("image/svg+xml")
            && item.inferred_format.as_deref() == Some("svg")));
    assert!(parsed
        .technical
        .favicons
        .iter()
        .any(|item| item.rel == "apple-touch-icon"
            && item.declared_sizes.as_deref() == Some("180x180")));
}

#[test]
fn test_hreflang_extraction() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(parsed.technical.hreflang_tags.len(), 1);
    assert_eq!(parsed.technical.hreflang_tags[0].hreflang, "pl");
    assert_eq!(
        parsed.technical.hreflang_tags[0].href,
        "https://example.com/pl/seomi"
    );
}

#[test]
fn test_json_ld_extraction() {
    let parsed = parse_html(SAMPLE_HTML, "https://example.com").unwrap();
    assert_eq!(parsed.structured_data.len(), 1);
    assert_eq!(parsed.structured_data[0].data_type, "SoftwareApplication");
    assert_eq!(parsed.structured_data[0].format, "JSON-LD");
}
