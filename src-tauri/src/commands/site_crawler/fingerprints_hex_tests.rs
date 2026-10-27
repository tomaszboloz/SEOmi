use super::*;

#[test]
fn content_fingerprint_is_lowercase_hex_sha256_of_the_lowercased_text() {
    let document =
        Html::parse_document("<html><body><main><p>Hello World</p></main></body></html>");
    let (words, hash) = normalized_content_fingerprint(&document);
    assert_eq!(words, 2);
    // sha256("hello world")
    assert_eq!(
        hash.as_deref(),
        Some("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9")
    );
}

#[test]
fn empty_content_has_no_fingerprint() {
    let document = Html::parse_document("<html><body></body></html>");
    assert_eq!(normalized_content_fingerprint(&document), (0, None));
}
