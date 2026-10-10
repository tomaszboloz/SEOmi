use super::*;

#[test]
fn hreflang_validator_accepts_grandfathered_complete_and_private_use_tags() {
    for value in [
        "X-DEFAULT",
        "i-klingon",
        "art-lojban",
        "en",
        "zh-cmn-Hans-CN",
        "de-CH-1901",
        "en-a-foo-b-bar-x-private",
        "en-x-one-two",
    ] {
        assert!(is_valid_hreflang_code(value), "{value}");
    }
}

#[test]
fn hreflang_validator_rejects_bad_primary_subtags_and_empty_parts() {
    for value in [
        "", "e", "123", "en-", "-en", "en--US", "en_US", "éx", "en-!",
    ] {
        assert!(!is_valid_hreflang_code(value), "{value}");
    }
}

#[test]
fn hreflang_validator_checks_extlang_script_region_and_variant_shapes() {
    for value in ["en-abc-def-ghi", "sr-Latn-RS", "es-419", "de-CH-1901-1996"] {
        assert!(is_valid_hreflang_code(value), "{value}");
    }
    for value in [
        "en-abc-def-ghi-jkl",
        "en-Latn-XYZ",
        "en-1234-1234",
        "en-US-US",
        "en-1901-1901",
    ] {
        assert!(!is_valid_hreflang_code(value), "{value}");
    }
}

#[test]
fn hreflang_validator_requires_extension_and_private_use_subtags() {
    for value in ["en-a", "en-x", "en-a-foo-a-bar", "en-a-foo-x"] {
        assert!(!is_valid_hreflang_code(value), "{value}");
    }
    assert!(is_valid_hreflang_code("en-a-foo-x-bar"));
}

#[test]
fn hreflang_url_comparison_ignores_fragments_and_rejects_unparseable_urls() {
    assert!(same_hreflang_url(
        "https://example.test/page#one",
        "https://example.test/page#two"
    ));
    assert!(!same_hreflang_url("relative", "https://example.test/page"));
    assert!(!same_hreflang_url("https://[", "https://example.test/page"));
}
