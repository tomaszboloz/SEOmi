use super::*;

#[test]
fn scope_allowlist_does_not_bypass_the_base_hosts_directory() {
    let allowed = vec!["example.com".into(), "partner.example".into()];
    for (candidate, expected) in [
        ("https://example.com/docs", true),
        ("https://example.com/docs/guide", true),
        ("https://example.com/docs-old", false),
        ("https://example.com/Docs/guide", false),
        ("https://example.com/docs%2Fguide", false),
        ("https://example.com/docs/../private", false),
        ("https://example.com/private", false),
        ("https://partner.example/private", true),
    ] {
        assert_eq!(
            matches_scope(
                &url::Url::parse(candidate).unwrap(),
                "example.com",
                false,
                Some(" /docs/ "),
                &allowed,
            ),
            expected,
            "{candidate}",
        );
    }
}

#[test]
fn subdomains_inherit_root_directory_but_require_a_complete_host_boundary() {
    let allowed = vec!["partner.example".into()];
    for (candidate, expected) in [
        ("https://docs.example.com/docs/guide", true),
        ("https://docs.example.com/private", false),
        ("https://api.partner.example/private", true),
        ("https://badpartner.example/docs", false),
        ("https://partner.example.attacker.test/docs", false),
        ("https://example.com.attacker.test/docs", false),
    ] {
        let parsed = url::Url::parse(candidate).unwrap();
        assert_eq!(
            matches_scope(&parsed, "EXAMPLE.COM", true, Some("/docs"), &allowed),
            expected,
            "{candidate}",
        );
    }
}

#[test]
fn allowed_hosts_normalize_idna_and_keep_distinct_hostnames() {
    assert_eq!(
        normalize_allowed_hosts(&[
            " https://BÜCHER.example./ ".into(),
            "xn--bcher-kva.example".into(),
            "docs.example".into(),
        ])
        .unwrap(),
        vec!["xn--bcher-kva.example", "docs.example"],
    );
}

#[test]
fn include_patterns_are_alternatives_and_exclusion_always_wins() {
    let include = vec![Regex::new("/docs/").unwrap(), Regex::new("/blog/").unwrap()];
    let exclude = vec![Regex::new("private").unwrap(), Regex::new("draft").unwrap()];
    for (candidate, expected) in [
        ("https://example.com/blog/post", true),
        ("https://example.com/docs/guide", true),
        ("https://example.com/blog/draft", false),
        ("https://example.com/docs/private", false),
        ("https://example.com/shop/item", false),
    ] {
        assert_eq!(matches_filters(candidate, &include, &exclude), expected);
    }
    assert!(!matches_filters(
        "https://example.com/private",
        &[],
        &exclude
    ));
}
