use super::{types::*, validation::validate_crawl_auth_profile};

fn profile() -> CrawlAuthProfile {
    CrawlAuthProfile {
        headers: vec![],
        cookie: None,
        proxy_url: None,
    }
}

#[test]
fn header_count_name_value_and_transport_control_boundaries_are_enforced() {
    let header = CrawlProfileHeader {
        name: "X-Test".into(),
        value: "x".repeat(8192),
    };
    let mut value = profile();
    value.headers = vec![header.clone(); 50];
    assert!(validate_crawl_auth_profile(&value).is_ok());
    value.headers.push(header.clone());
    assert!(validate_crawl_auth_profile(&value)
        .unwrap_err()
        .contains("50"));
    for name in ["", "bad name", "X-\r\nInjected", &"x".repeat(257)] {
        value.headers = vec![CrawlProfileHeader {
            name: name.into(),
            ..header.clone()
        }];
        assert!(validate_crawl_auth_profile(&value).is_err());
    }
    for name in [
        "Host",
        "Content-Length",
        "Connection",
        "Transfer-Encoding",
        "Cookie",
        "User-Agent",
    ] {
        value.headers = vec![CrawlProfileHeader {
            name: name.into(),
            ..header.clone()
        }];
        assert!(validate_crawl_auth_profile(&value)
            .unwrap_err()
            .contains("dedicated control"));
    }
    for text in ["x".repeat(8193), "private\nInjected".into()] {
        value.headers = vec![CrawlProfileHeader {
            value: text,
            ..header.clone()
        }];
        assert!(validate_crawl_auth_profile(&value).is_err());
    }
}

#[test]
fn cookies_and_proxy_url_boundaries_are_enforced() {
    let mut value = profile();
    value.cookie = Some("x".repeat(16384));
    assert!(validate_crawl_auth_profile(&value).is_ok());
    for cookie in ["x".repeat(16385), "private\r\n".into()] {
        value.cookie = Some(cookie);
        assert!(validate_crawl_auth_profile(&value).is_err());
    }
    value.cookie = None;
    for proxy in [
        "x".repeat(2049),
        "not a URL".into(),
        "file:///tmp/proxy".into(),
        "https://".into(),
    ] {
        value.proxy_url = Some(proxy);
        assert!(validate_crawl_auth_profile(&value).is_err());
    }
    for proxy in [
        "http://proxy.example",
        "https://user:synthetic@proxy.example:8443",
    ] {
        value.proxy_url = Some(proxy.into());
        assert!(validate_crawl_auth_profile(&value).is_ok());
    }
}
