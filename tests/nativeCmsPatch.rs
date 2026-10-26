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

#[tokio::test]
async fn cms_patch_request_validates_and_handles_credentials_and_network() {
    let mut input = request();
    input.url = "https://127.0.0.1".into();
    assert_eq!(
        cms_patch_request(input).await.unwrap_err(),
        "Unsafe CMS URL"
    );

    let mut input = request();
    input.url = "http://example.com".into();
    assert_eq!(
        cms_patch_request(input).await.unwrap_err(),
        "CMS URL must use HTTPS"
    );

    let mut input = request();
    input.credential = "cms_auth_missing-cred".into();
    assert_eq!(
        cms_patch_request(input).await.unwrap_err(),
        "CMS credential unavailable"
    );

    let _ = crate::commands::settings::set_secret(
        "cms_auth_bad-header".into(),
        "invalid\nnewline".into(),
    )
    .await;
    let mut input = request();
    input.credential = "cms_auth_bad-header".into();
    assert_eq!(
        cms_patch_request(input).await.unwrap_err(),
        "CMS credential is not a valid header value"
    );

    let builder =
        crate::services::http_client::resolver::public_client_builder_with_lookup(|_| async {
            Err(std::io::Error::new(
                std::io::ErrorKind::ConnectionRefused,
                "transport connection refused",
            ))
        });
    let mut input = request();
    input.url = "https://example.com/cms".into();
    input
        .headers
        .insert("Accept".into(), "application/json".into());
    input.body = Some("{\"patch\": true}".into());
    let err = cms_patch_request_with_builder(input, builder)
        .await
        .unwrap_err();
    assert_eq!(err, "CMS request failed");
}

#[path = "nativeCmsPatchResponse.rs"]
mod response;
