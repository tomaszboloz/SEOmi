use super::normalize_allowed_hosts;

#[test]
fn duplicate_hosts_are_collapsed_case_insensitively() {
    let hosts = [
        "Example.com",
        "https://example.com",
        "example.com.",
        "a.test",
    ]
    .map(String::from);
    assert_eq!(
        normalize_allowed_hosts(&hosts).unwrap(),
        vec!["example.com".to_string(), "a.test".to_string()]
    );
}

#[test]
fn a_bare_dot_host_collapses_to_an_empty_entry_that_is_never_deduplicated() {
    let hosts = [".", "https://."].map(String::from);
    assert_eq!(
        normalize_allowed_hosts(&hosts).unwrap(),
        vec![String::new(), String::new()]
    );
}
