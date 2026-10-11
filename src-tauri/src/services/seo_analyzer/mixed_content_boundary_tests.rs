use super::{collect_http_resource, detect_mixed_content_resources};
use std::collections::BTreeSet;
use url::Url;

#[test]
fn malformed_resource_urls_are_ignored_without_polluting_findings() {
    let page = Url::parse("https://example.test/page").unwrap();
    let mut found = BTreeSet::new();
    for value in ["http://[", "http://%zz", "https://safe.test/resource"] {
        collect_http_resource(value, &page, &mut found);
    }
    assert!(found.is_empty());
}

#[test]
fn relative_resources_use_the_page_origin_and_keep_only_http() {
    let page = Url::parse("https://example.test/docs/page").unwrap();
    let html = r#"
        <img src="//cdn.example.test/image.png">
        <script src="/app.js"></script>
        <iframe src="//secure.example.test/frame"></iframe>
        <link rel="stylesheet" href="//cdn.example.test/style.css">
    "#;
    assert!(detect_mixed_content_resources(html, &page).is_empty());
}
