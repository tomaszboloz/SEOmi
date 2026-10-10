use super::page_type_guidance::thin_issue;

#[test]
fn paginated_path_requires_positive_numeric_page_segment() {
    for suffix in ["page/0", "page/not-number", "paged/2", "page"] {
        let url = format!("https://example.test/archive/{suffix}");
        assert_eq!(
            thin_issue("<html><body><p>Index</p></body></html>", &url, "http").as_deref(),
            Some("Thin text content: 1 words")
        );
    }
}

#[test]
fn graph_type_arrays_and_schema_urls_are_listing_evidence() {
    for json in [
        r#"{"@graph":[{"@type":["Thing","CollectionPage"]}]}"#,
        r#"{"@type":"https://schema.org/Blog"}"#,
    ] {
        let html = format!("<html><body><script type='application/ld+json'>{json}</script><p>Index</p></body></html>");
        assert!(thin_issue(&html, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Listing or archive page"));
    }
}

#[test]
fn malformed_and_non_collection_json_ld_stays_thin() {
    for json in [
        "{not json}",
        r#"{"@graph":[{"@type":["Article","Thing"]}]}"#,
    ] {
        let html = format!("<html><body><script type='application/ld+json'>{json}</script><p>Index</p></body></html>");
        assert_eq!(
            thin_issue(&html, "https://example.test/archive", "http").as_deref(),
            Some("Thin text content: 1 words")
        );
    }
}

#[test]
fn duplicate_targets_and_chrome_inside_main_do_not_fake_listing_evidence() {
    let duplicates = "<html><body><a href='/same'>Same</a><a href='/same'>Same</a><a href='/same'>Same</a><a href='/same'>Same</a></body></html>";
    assert_eq!(
        thin_issue(duplicates, "https://example.test/article", "http").as_deref(),
        Some("Thin text content: 4 words")
    );
    let chrome = "<html><body><main><nav><a href='/one'>One</a><a href='/two'>Two</a><a href='/three'>Three</a><a href='/four'>Four</a></nav><p>Short article text.</p></main></body></html>";
    assert_eq!(
        thin_issue(chrome, "https://example.test/article", "http").as_deref(),
        Some("Thin text content: 3 words")
    );
}

#[test]
fn non_html_extensions_are_not_counted_as_page_navigation() {
    let html = "<html><body><a href='/one.weirdhtml'>One</a><a href='/two.weirdhtml'>Two</a><a href='/three.weirdhtml'>Three</a><a href='/four.weirdhtml'>Four</a></body></html>";
    assert_eq!(
        thin_issue(html, "https://example.test/article", "http").as_deref(),
        Some("Thin text content: 4 words")
    );
}

#[test]
fn application_guidance_requires_both_known_root_and_script_bundle() {
    for html in [
        "<html><body><div id='root'></div></body></html>",
        "<html><body><div id='content'></div><script src='/assets/app.js'></script></body></html>",
        "<html><body><div id='root'></div><script src='/styles/app.css'></script></body></html>",
        "<html><body><div id='root'>1 2 3 4 5 6 7 8 9 10</div><script src='/assets/app.js'></script></body></html>",
        "<html><body><script type='text/javascript'>alert(1)</script><p>P</p></body></html>",
    ] {
        assert!(thin_issue(html, "https://example.test/app", "http")
            .unwrap()
            .starts_with("Thin text content"));
    }
}

#[test]
fn paginated_path_and_rel_links_branches() {
    for url in [
        "https://example.test/archive/page/2/",
        "https://example.test/archive/PAGE/10",
    ] {
        let issue = thin_issue("<html><body><p>Index</p></body></html>", url, "http").unwrap();
        assert!(issue.starts_with("Listing or archive page"));
    }
    for html in [
        "<html><body><a rel='next' href='/next'>N</a></body></html>",
        "<html><body><a rel='prev' href='/prev'>P</a></body></html>",
        "<html><body><link rel='canonical next' href='/next'></body></html>",
    ] {
        let issue = thin_issue(html, "https://example.test/archive", "http").unwrap();
        assert!(issue.starts_with("Listing or archive page"));
    }
    for bad_url in ["not a url", "data:text/html,test"] {
        assert_eq!(
            thin_issue("<html><body><p>Index</p></body></html>", bad_url, "http").as_deref(),
            Some("Thin text content: 1 words")
        );
    }
}

#[test]
fn collection_schema_array_types_and_microdata_typeof() {
    for json in [
        r#"[{"@type":"Blog"}]"#,
        r#"{"@type":["Article","CollectionPage"]}"#,
        r#"{"@type":[123,"Blog"]}"#,
    ] {
        let html = format!("<html><body><script type='application/ld+json'>{json}</script><p>Index</p></body></html>");
        assert!(thin_issue(&html, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Listing or archive page"));
    }
    for micro in [
        r#"<div typeof="Blog"><p>Index</p></div>"#,
        r#"<div typeof="https://schema.org/CollectionPage"><p>Index</p></div>"#,
        r#"<div typeof="other Blog item"><p>Index</p></div>"#,
    ] {
        let html = format!("<html><body>{micro}</body></html>");
        assert!(thin_issue(&html, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Listing or archive page"));
    }
}

#[test]
fn mostly_internal_links_branches_and_thresholds() {
    let role_main = "<html><body><div role='main'><div aria-label='breadcrumb navigation'><a href='/b'>B</a></div><a href='/a.html'>One</a><a href='/b.php'>Two</a><a href='/c.htm'>Three</a><a href='/d/'>Four</a></div></body></html>";
    assert!(
        thin_issue(role_main, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Listing or archive page")
    );

    let skipped = "<html><body><a href='mailto:test@example.test'>Mail</a><a href='tel:123'>Tel</a><a href='#frag'>Frag</a><a href='/one'>One</a></body></html>";
    assert_eq!(
        thin_issue(skipped, "https://example.test/archive", "http").as_deref(),
        Some("Thin text content: 4 words")
    );

    let low_density = "<html><body><a href='/a'>One</a><a href='/b'>Two</a><a href='/c'>Three</a><a href='/d'>Four</a><p>This is a long article paragraph with many words that make anchor density way lower than forty-five percent threshold.</p></body></html>";
    assert!(
        thin_issue(low_density, "https://example.test/archive", "http")
            .unwrap()
            .starts_with("Thin text content")
    );
}
