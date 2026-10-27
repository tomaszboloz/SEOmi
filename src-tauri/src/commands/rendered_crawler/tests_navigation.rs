use url::Url;

use super::models::RenderedArtifactKind;
use super::navigation::{is_allowed_crawl_navigation, is_allowed_navigation, parse_capture_chunk};
use super::preview::normalize_preview_value;

#[test]
fn rendered_navigation_is_confined_to_http_scope_and_path_boundary() {
    let base = Url::parse("https://www.example.test/articles").unwrap();
    assert!(is_allowed_navigation(
        &base,
        "www.example.test",
        false,
        Some("/articles")
    ));
    assert!(is_allowed_navigation(
        &Url::parse("https://www.example.test/articles/seo").unwrap(),
        "www.example.test",
        false,
        Some("/articles")
    ));
    assert!(!is_allowed_navigation(
        &Url::parse("https://www.example.test/articles-evil").unwrap(),
        "www.example.test",
        false,
        Some("/articles")
    ));
    assert!(!is_allowed_navigation(
        &Url::parse("https://elsewhere.test/articles").unwrap(),
        "www.example.test",
        true,
        None
    ));
    assert!(!is_allowed_navigation(
        &Url::parse("file:///etc/passwd").unwrap(),
        "www.example.test",
        false,
        None
    ));
    assert!(!is_allowed_navigation(
        &Url::parse("https://user@example.test/articles").unwrap(),
        "example.test",
        false,
        None
    ));
}

#[test]
fn allowlisted_hosts_are_in_crawl_scope_without_the_seed_path_scope() {
    let allowed = vec!["docs.example.test".to_string()];
    let docs = Url::parse("https://docs.example.test/guide").unwrap();
    let seed = ("www.example.test", Some("/articles"));
    assert!(!is_allowed_crawl_navigation(
        &docs,
        seed.0,
        false,
        seed.1,
        &[]
    ));
    assert!(is_allowed_crawl_navigation(
        &docs, seed.0, false, seed.1, &allowed
    ));
    // The seed host keeps its path scope even with an allowlist.
    let shop = Url::parse("https://www.example.test/shop").unwrap();
    assert!(!is_allowed_crawl_navigation(
        &shop, seed.0, false, seed.1, &allowed
    ));
    let elsewhere = Url::parse("https://elsewhere.test/guide").unwrap();
    assert!(!is_allowed_crawl_navigation(
        &elsewhere, seed.0, true, None, &allowed
    ));
}

#[test]
fn capture_chunk_requires_nonce_valid_bounds_and_payload() {
    let nonce = "aabbccddeeff00112233445566778899";
    let valid = Url::parse(&format!(
        "seomi-capture://{nonce}/3/0/2?data=eyJvayI6dHJ1ZX0"
    ))
    .unwrap();
    let chunk = parse_capture_chunk(&valid, nonce).unwrap();
    assert_eq!(chunk.sequence, 3);
    assert_eq!(chunk.total, 2);
    assert_eq!(chunk.data, "eyJvayI6dHJ1ZX0");

    assert!(parse_capture_chunk(&valid, "different-nonce").is_none());
    assert!(parse_capture_chunk(
        &Url::parse(&format!("seomi-capture://{nonce}/3/2/2?data=abc")).unwrap(),
        nonce,
    )
    .is_none());
    assert!(parse_capture_chunk(
        &Url::parse(&format!("seomi-capture://{nonce}/3/0/2?data=")).unwrap(),
        nonce,
    )
    .is_none());
}

#[test]
fn preview_values_are_bounded_and_trimmed() {
    assert_eq!(
        normalize_preview_value("  h1  ", "selector", 10).unwrap(),
        "h1"
    );
    assert!(normalize_preview_value("", "selector", 10).is_err());
    assert!(normalize_preview_value("123456", "selector", 5).is_err());
    assert!(normalize_preview_value("bad\0selector", "selector", 50).is_err());
}

#[test]
fn rendered_artifact_kind_has_stable_desktop_metadata() {
    let screenshot = RenderedArtifactKind::parse("PNG").unwrap();
    assert_eq!(screenshot.label(), "screenshot");
    assert_eq!(screenshot.content_type(), "image/png");
    assert_eq!(screenshot.extension(), "png");

    let pdf = RenderedArtifactKind::parse(" pdf ").unwrap();
    assert_eq!(pdf.label(), "pdf");
    assert_eq!(pdf.content_type(), "application/pdf");
    assert_eq!(pdf.extension(), "pdf");
    assert!(RenderedArtifactKind::parse("html").is_err());
}
