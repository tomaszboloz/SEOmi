use super::*;

#[test]
fn is_other_resource_url_handles_all_supported_extensions_and_casing() {
    let extensions = [
        ".pdf", ".xml", ".json", ".zip", ".csv", ".txt", ".woff", ".woff2", ".ttf", ".otf", ".mp4",
        ".webm", ".mp3", ".wav",
    ];
    for ext in extensions {
        let url = url::Url::parse(&format!("https://example.com/file{ext}")).unwrap();
        assert!(is_other_resource_url(&url), "failed for {ext}");

        let upper_url = url::Url::parse(&format!(
            "https://example.com/file{}",
            ext.to_ascii_uppercase()
        ))
        .unwrap();
        assert!(
            is_other_resource_url(&upper_url),
            "failed for uppercase {ext}"
        );
    }

    for non_res in [".html", ".htm", ".php", ".png", ".jpg", ".css", ".js", ""] {
        let url = url::Url::parse(&format!("https://example.com/page{non_res}")).unwrap();
        assert!(!is_other_resource_url(&url), "should not match {non_res}");
    }
}

#[test]
fn add_resource_candidate_resource_type_enabled_guard() {
    let mut config = crawl_config_for_test();
    config.crawl_images = false;
    config.crawl_stylesheets = false;
    config.crawl_scripts = false;
    config.crawl_other_resources = false;

    let base = url::Url::parse("https://example.com/page").unwrap();
    let mut candidates = HashMap::new();

    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "logo.png",
        "image",
        "example.com",
        &config,
    );
    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "style.css",
        "stylesheet",
        "example.com",
        &config,
    );
    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "app.js",
        "script",
        "example.com",
        &config,
    );
    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "doc.pdf",
        "other",
        "example.com",
        &config,
    );

    assert!(candidates.is_empty());
}

#[test]
fn add_resource_candidate_scope_and_url_validation() {
    let mut config = crawl_config_for_test();
    config.crawl_images = true;
    config.allow_subdomains = false;

    let base = url::Url::parse("https://example.com/page").unwrap();
    let mut candidates = HashMap::new();

    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "javascript:void(0)",
        "image",
        "example.com",
        &config,
    );
    assert!(candidates.is_empty());

    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "https://external.org/pic.png",
        "image",
        "example.com",
        &config,
    );
    assert!(candidates.is_empty());

    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "pic.png",
        "image",
        "example.com",
        &config,
    );
    assert_eq!(candidates.len(), 1);

    add_resource_candidate(
        &mut candidates,
        "https://example.com/page",
        &base,
        "pic.png",
        "image",
        "example.com",
        &config,
    );
    assert_eq!(candidates.values().next().unwrap().source_urls.len(), 1);

    add_resource_candidate(
        &mut candidates,
        "https://example.com/other-page",
        &base,
        "pic.png",
        "image",
        "example.com",
        &config,
    );
    assert_eq!(candidates.values().next().unwrap().source_urls.len(), 2);
}
