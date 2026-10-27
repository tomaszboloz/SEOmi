use super::*;
use serde_json::json;

fn codes(document: serde_json::Value) -> Vec<String> {
    validate_jsonld(&document)
        .into_iter()
        .map(|issue| issue.code)
        .collect()
}

#[test]
fn person_and_author_require_name_but_accept_a_valid_name() {
    for kind in ["Person", "Author"] {
        let missing = codes(json!({
            "@context": "https://schema.org",
            "@type": kind
        }));
        assert!(missing.iter().any(|code| code == "person-name-missing"));

        let valid = codes(json!({
            "@context": "https://schema.org",
            "@type": kind,
            "name": "Ada Lovelace"
        }));
        assert!(!valid.iter().any(|code| code == "person-name-missing"));
    }
}

#[test]
fn image_object_requires_content_url_or_url() {
    let missing = codes(json!({
        "@context": "https://schema.org",
        "@type": "ImageObject"
    }));
    assert!(missing.iter().any(|code| code == "image-url-missing"));

    for property in ["contentUrl", "url"] {
        let valid = codes(json!({
            "@context": "https://schema.org",
            "@type": "ImageObject",
            (property): "https://example.test/image.webp"
        }));
        assert!(!valid.iter().any(|code| code == "image-url-missing"));
    }
}
