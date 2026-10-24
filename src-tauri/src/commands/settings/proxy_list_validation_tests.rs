use super::{types::*, validation::validate_crawl_auth_profile};

fn with_proxy(value: &str) -> CrawlAuthProfile {
    CrawlAuthProfile {
        headers: Vec::new(),
        cookie: None,
        proxy_url: Some(value.into()),
    }
}

#[test]
fn proxy_list_accepts_comma_semicolon_and_whitespace_separators() {
    let list = "http://a.test:8080, https://b.test:443;http://c.test:3128\nhttp://d.test:1";
    assert!(validate_crawl_auth_profile(&with_proxy(list)).is_ok());
}

#[test]
fn proxy_list_rejects_one_bad_entry_duplicates_and_empty_values() {
    for bad in [
        "http://a.test:1, socks5://b.test:1",
        "http://a.test:1, nonsense",
        "http://a.test:1 http://a.test:1",
        "   ",
        ",,;",
    ] {
        let error = validate_crawl_auth_profile(&with_proxy(bad)).unwrap_err();
        assert!(
            error.starts_with("Invalid proxy configuration"),
            "{bad}: {error}"
        );
    }
}

#[test]
fn proxy_list_is_limited_to_64_entries() {
    let build = |count: usize| {
        (0..count)
            .map(|index| format!("http://p{index}.test:1"))
            .collect::<Vec<_>>()
            .join(",")
    };
    assert!(validate_crawl_auth_profile(&with_proxy(&build(64))).is_ok());
    assert!(validate_crawl_auth_profile(&with_proxy(&build(65))).is_err());
}

#[test]
fn a_single_oversized_entry_is_rejected() {
    let long = format!("http://a.test/{}", "x".repeat(2_100));
    assert!(validate_crawl_auth_profile(&with_proxy(&long)).is_err());
}
