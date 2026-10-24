use super::*;

fn request() -> CmsRequest {
    CmsRequest {
        method: "GET".into(),
        url: "https://example.com".into(),
        headers: HashMap::new(),
        body: None,
        credential: String::new(),
        follow_redirects: false,
        timeout_ms: 15_000,
    }
}

#[test]
fn validates_public_https_requests_without_network() {
    for method in ["GET", "POST", "PUT"] {
        let mut input = request();
        input.method = method.into();
        input.body = Some("{}".into());
        input.credential = "cms_auth_demo".into();
        for name in ["Accept", "Content-Type", "If-Match"] {
            input.headers.insert(name.into(), "application/json".into());
        }
        assert!(validate(&input).is_ok());
    }
    assert!(validate(&request()).is_ok());
}

#[test]
fn refuses_unsafe_cms_destinations() {
    for url in [
        "http://example.com",
        "example.com",
        "https://localhost",
        "https://10.0.0.1",
        "https://127.0.0.1",
        "https://[::1]",
        "https://user:pass@example.com",
        "https://cms.internal",
    ] {
        let mut input = request();
        input.url = url.into();
        assert!(validate(&input).is_err(), "{url}");
    }
}

#[test]
fn refuses_redirects_methods_headers_oversize_and_unrelated_credentials() {
    let mut input = request();
    input.follow_redirects = true;
    assert!(validate(&input).is_err());
    input = request();
    input.method = "DELETE".into();
    assert!(validate(&input).is_err());
    input = request();
    input
        .headers
        .insert("Authorization".into(), "forbidden".into());
    assert!(validate(&input).is_err());
    input = request();
    input.body = Some("x".repeat(MAX_BYTES + 1));
    assert!(validate(&input).is_err());
    input = request();
    input.credential = "openai_api_key".into();
    assert!(validate(&input).is_err());
}
