use super::*;

#[test]
fn scope_path_normalization_handles_missing_root_and_slashes() {
    for path in [None, Some(""), Some("  "), Some("/")] {
        assert_eq!(normalize_scope_path(path), None);
    }
    assert_eq!(
        normalize_scope_path(Some(" //Docs/// ")),
        Some("/Docs".into())
    );
}

#[test]
fn allowed_hosts_skip_blanks_dedupe_and_reject_every_extra_url_component() {
    let normalized = normalize_allowed_hosts(&[
        " ".into(),
        " HTTPS://Docs.Example.com. ".into(),
        "docs.example.com".into(),
    ])
    .unwrap();
    assert_eq!(normalized, vec!["docs.example.com"]);
    for candidate in [
        "%",
        "docs.example/path",
        "docs.example?x=1",
        "docs.example#fragment",
        "user@docs.example",
        "https://:secret@docs.example",
        "docs.example:8443",
        "https://",
    ] {
        assert!(
            normalize_allowed_hosts(&[candidate.into()]).is_err(),
            "{candidate}"
        );
    }
    let err = normalize_allowed_hosts(&["file:///".into()]).unwrap_err();
    assert!(err.contains("Allowed host has no hostname"));
}

#[test]
fn scope_handles_missing_hosts_boundaries_and_filter_defaults() {
    let file = url::Url::parse("file:///tmp/page").unwrap();
    assert!(!matches_scope(&file, "example.com", false, None, &[]));
    assert!(host_matches_root("Example.COM", "example.com", false));
    assert!(!host_matches_root("badexample.com", "example.com", true));

    let exact = url::Url::parse("https://example.com/docs").unwrap();
    assert!(matches_scope(
        &exact,
        "example.com",
        false,
        Some("docs"),
        &[]
    ));
    assert!(matches_scope(
        &url::Url::parse("https://other.example/docs").unwrap(),
        "example.com",
        false,
        Some("/private"),
        &["other.example".into()]
    ));
    assert!(matches_filters("anything", &[], &[]));
}
