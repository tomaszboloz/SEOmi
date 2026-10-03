use super::{secret_names::*, types::*, validation::validate_crawl_auth_profile};

#[test]
fn only_scoped_google_refresh_tokens_are_allowed_in_secure_storage() {
    assert!(is_supported_secret_name("gsc_refresh_token_project-1"));
    assert!(is_gsc_refresh_secret("gsc_refresh_token_project-1"));
    assert!(!is_supported_secret_name("gsc_refresh_token_"));
    assert!(!is_supported_secret_name(
        "gsc_refresh_token_project/../outside"
    ));
}

#[test]
fn google_performance_api_keys_are_project_scoped() {
    assert!(is_supported_secret_name("google_metrics_api_key_project-1"));
    assert!(!is_supported_secret_name("google_metrics_api_key_"));
    assert!(!is_supported_secret_name(
        "google_metrics_api_key_project/../other"
    ));
}

#[test]
fn crawl_auth_profile_rejects_transport_control_headers() {
    let profile = CrawlAuthProfile {
        headers: vec![CrawlProfileHeader {
            name: "Host".into(),
            value: "internal.example".into(),
        }],
        cookie: None,
        proxy_url: None,
    };

    assert!(validate_crawl_auth_profile(&profile)
        .unwrap_err()
        .contains("dedicated control"));
}

#[test]
fn crawl_auth_profile_accepts_authorization_and_cookie_in_the_keychain_payload() {
    let profile = CrawlAuthProfile {
        headers: vec![CrawlProfileHeader {
            name: "Authorization".into(),
            value: "Bearer test-token".into(),
        }],
        cookie: Some("session=test".into()),
        proxy_url: Some("https://user:password@proxy.example:8443".into()),
    };

    assert!(validate_crawl_auth_profile(&profile).is_ok());
    assert_eq!(
        crawl_auth_secret_name("project-1", "profile-1").unwrap(),
        "crawl_auth_project-1_profile-1"
    );
}

#[test]
fn crawl_auth_profile_rejects_non_http_proxy_schemes() {
    let profile = CrawlAuthProfile {
        headers: Vec::new(),
        cookie: None,
        proxy_url: Some("file:///tmp/proxy".into()),
    };

    assert!(validate_crawl_auth_profile(&profile)
        .unwrap_err()
        .contains("HTTP or HTTPS"));
}
