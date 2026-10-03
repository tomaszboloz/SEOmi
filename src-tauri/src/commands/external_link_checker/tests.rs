use super::network::{checked_public_addresses, normalize_external_url};
use url::Url;

#[test]
fn rejects_embedded_credentials_and_non_http_schemes() {
    assert!(normalize_external_url("https://user:pass@example.com/").is_err());
    assert!(normalize_external_url("file:///etc/passwd").is_err());
    assert!(normalize_external_url("http://127.0.0.1/").is_err());
}

#[test]
fn normalizes_and_removes_fragments_before_deduplication() {
    let first = normalize_external_url("https://example.com/page#first").unwrap();
    let second = normalize_external_url("https://example.com/page#second").unwrap();
    assert_eq!(first, second);
    assert_eq!(first.as_str(), "https://example.com/page");
}

#[tokio::test]
async fn resolves_all_public_addresses_and_blocks_localhost() {
    let local = Url::parse("http://127.0.0.1/").unwrap();
    assert!(checked_public_addresses(&local).await.is_err());
}
