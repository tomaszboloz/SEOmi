use super::super::{
    setup_client::{build_crawler_client, build_crawler_client_with_profile_loader},
    setup_config::default_crawl_config,
};
use super::setup_client_profile_fixture::{profile, proxy_server};
use crate::commands::settings::CrawlProfileHeader;

#[tokio::test]
async fn direct_build_crawler_client_covers_project_and_profile_lookup() {
    let mut config = default_crawl_config(None);
    let (client, ua, cookie) = build_crawler_client(Some("project-direct"), &config, None).unwrap();
    assert_eq!(ua, "SEOmi-Crawler/0.1 (Desktop SEO Auditor)");
    assert!(cookie.is_none());
    drop(client);

    config.request_profile_id = Some("missing-profile-id".into());
    let err = build_crawler_client(Some("project-direct"), &config, None).unwrap_err();
    assert!(err.contains("credential store") || err.contains("profile"));

    let profile_id = "test-prof-direct".to_string();
    let project_id = "test-proj-direct".to_string();
    let headers = vec![
        CrawlProfileHeader {
            name: "Authorization".into(),
            value: "Bearer xyz".into(),
        },
        CrawlProfileHeader {
            name: "X-Auth-Token".into(),
            value: "token123".into(),
        },
        CrawlProfileHeader {
            name: "api-key".into(),
            value: "key123".into(),
        },
    ];
    crate::commands::settings::save_crawl_auth_profile(
        project_id.clone(),
        profile_id.clone(),
        headers,
        Some("cookie_val=abc".into()),
        None,
    )
    .await
    .unwrap();

    config.request_profile_id = Some(profile_id.clone());
    let (client, _ua, cookie) = build_crawler_client(Some(&project_id), &config, None).unwrap();
    assert_eq!(cookie.as_deref(), Some("cookie_val=abc"));
    drop(client);

    let _ = crate::commands::settings::delete_crawl_auth_profile(project_id, profile_id).await;
}

#[test]
fn timeout_clamping_and_ssl_verification_branches() {
    let mut config = default_crawl_config(None);
    config.request_timeout_secs = Some(999);
    config.verify_ssl = true;
    let (client, _, _) = build_crawler_client(None, &config, None).unwrap();
    drop(client);

    config.request_timeout_secs = Some(30);
    config.verify_ssl = false;
    let (client, _, _) = build_crawler_client(None, &config, None).unwrap();
    drop(client);
}

#[test]
fn user_agent_boundary_at_1024_characters() {
    let mut config = default_crawl_config(None);
    config.user_agent = Some("a".repeat(1_024));
    let (_, ua, _) = build_crawler_client(None, &config, None).unwrap();
    assert_eq!(ua.len(), 1_024);

    config.user_agent = Some("a".repeat(1_025));
    let err = build_crawler_client(None, &config, None).unwrap_err();
    assert_eq!(err, "User-Agent exceeds the 1024-character safety limit.");
}

#[tokio::test]
async fn proxy_configuration_success_and_error_handling() {
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-proxy".into());
    let result =
        build_crawler_client_with_profile_loader(Some("project-proxy"), &config, None, |_, _| {
            Ok(profile(
                Vec::new(),
                None,
                Some("http://127.0.0.1:8080".into()),
            ))
        });
    assert!(result.is_ok());

    let err =
        build_crawler_client_with_profile_loader(Some("project-proxy"), &config, None, |_, _| {
            Ok(profile(Vec::new(), None, Some("not a valid proxy".into())))
        })
        .unwrap_err();
    assert!(err.starts_with("Invalid proxy configuration:"));
}

#[tokio::test]
async fn headers_with_token_and_key_and_cookie_variations() {
    let (proxy, task) = proxy_server().await;
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-tokens".into());
    let headers = vec![
        CrawlProfileHeader {
            name: "X-Auth-Token".into(),
            value: "secret-token".into(),
        },
        CrawlProfileHeader {
            name: "API-Key".into(),
            value: "secret-key".into(),
        },
    ];
    let (client, _, _) =
        build_crawler_client_with_profile_loader(Some("proj"), &config, None, |_, _| {
            Ok(profile(headers, Some("session_id=valid"), Some(proxy)))
        })
        .unwrap();
    client.get("http://example.test/tok").send().await.unwrap();
    let req = task.await.unwrap().to_ascii_lowercase();
    assert!(req.contains("x-auth-token: secret-token"));
    assert!(req.contains("api-key: secret-key"));
    assert!(req.contains("cookie: session_id=valid"));

    let res = build_crawler_client_with_profile_loader(Some("proj"), &config, None, |_, _| {
        Ok(profile(Vec::new(), Some("bad\r\ncookie\0val"), None))
    });
    assert!(res.is_ok());
}
