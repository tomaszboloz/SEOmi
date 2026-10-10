use super::super::{
    setup_client::build_crawler_client_with_profile_loader, setup_config::default_crawl_config,
};
use super::setup_client_profile_fixture::{profile, proxy_server};
use crate::commands::settings::CrawlProfileHeader;

#[test]
fn profile_loader_receives_identifiers_and_propagates_errors() {
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-7".into());
    let error = build_crawler_client_with_profile_loader(
        Some("project-42"),
        &config,
        None,
        |project_id, profile_id| {
            assert_eq!(project_id, "project-42");
            assert_eq!(profile_id, "profile-7");
            Err("synthetic profile failure".into())
        },
    )
    .unwrap_err();
    assert_eq!(error, "synthetic profile failure");
}

#[tokio::test]
async fn injected_profile_applies_headers_cookie_proxy_and_configured_user_agent() {
    let (proxy, task) = proxy_server().await;
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-1".into());
    config.user_agent = Some("Configured Agent".into());
    let headers = vec![
        CrawlProfileHeader {
            name: "Authorization".into(),
            value: "Bearer synthetic".into(),
        },
        CrawlProfileHeader {
            name: "X-Fixture".into(),
            value: "enabled".into(),
        },
        CrawlProfileHeader {
            name: "X-API-KEY".into(),
            value: "synthetic-key".into(),
        },
    ];
    let (client, user_agent, rendered_cookie) = build_crawler_client_with_profile_loader(
        Some("project-1"),
        &config,
        Some("Argument Agent".into()),
        |_, _| Ok(profile(headers, Some("session=synthetic"), Some(proxy))),
    )
    .unwrap();
    assert_eq!(user_agent, "Configured Agent");
    assert_eq!(rendered_cookie.as_deref(), Some("session=synthetic"));
    assert_eq!(
        client
            .get("http://example.test/fixture")
            .send()
            .await
            .unwrap()
            .status(),
        reqwest::StatusCode::OK
    );
    let request = task.await.unwrap().to_ascii_lowercase();
    for expected in [
        "authorization: bearer synthetic",
        "x-fixture: enabled",
        "x-api-key: synthetic-key",
        "cookie: session=synthetic",
        "user-agent: configured agent",
    ] {
        assert!(
            request.contains(expected),
            "missing {expected} in {request}"
        );
    }
}

#[tokio::test]
async fn malformed_profile_values_are_skipped_without_losing_valid_headers() {
    let (proxy, task) = proxy_server().await;
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-2".into());
    let headers = vec![
        CrawlProfileHeader {
            name: "bad\nname".into(),
            value: "ignored".into(),
        },
        CrawlProfileHeader {
            name: "X-Good".into(),
            value: "yes".into(),
        },
        CrawlProfileHeader {
            name: "X-Bad".into(),
            value: "bad\nvalue".into(),
        },
    ];
    let (client, _, _) =
        build_crawler_client_with_profile_loader(Some("project-2"), &config, None, |_, _| {
            Ok(profile(headers, Some("bad\ncookie"), Some(proxy)))
        })
        .unwrap();
    client
        .get("http://example.test/malformed")
        .send()
        .await
        .unwrap();
    let request = task.await.unwrap().to_ascii_lowercase();
    assert!(request.contains("x-good: yes"));
    assert!(!request.contains("bad"));
}

#[test]
fn rendered_mode_rejects_profile_transport_and_invalid_proxy_is_reported() {
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-3".into());
    config.crawl_mode = "browser-rendered".into();
    let error =
        build_crawler_client_with_profile_loader(Some("project-3"), &config, None, |_, _| {
            Ok(profile(
                vec![CrawlProfileHeader {
                    name: "X-Blocked".into(),
                    value: "yes".into(),
                }],
                None,
                None,
            ))
        })
        .unwrap_err();
    assert!(error.contains("supports cookies from the selected profile only"));

    config.crawl_mode = "http".into();
    let error =
        build_crawler_client_with_profile_loader(Some("project-3"), &config, None, |_, _| {
            Ok(profile(Vec::new(), None, Some("not a proxy".into())))
        })
        .unwrap_err();
    assert!(error.starts_with("Invalid proxy configuration:"));
}
