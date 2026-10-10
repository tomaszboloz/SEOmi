use super::super::{setup_client::build_crawler_client, setup_config::default_crawl_config};

#[test]
fn saved_request_profile_requires_a_project_before_keychain_access() {
    let mut config = default_crawl_config(None);
    config.request_profile_id = Some("profile-1".into());

    assert_eq!(
        build_crawler_client(None, &config, None).unwrap_err(),
        "Select a project before using a saved request profile."
    );
}

#[test]
fn client_applies_user_agent_precedence_and_rejects_invalid_values() {
    let mut config = default_crawl_config(None);
    config.user_agent = Some("  ".into());
    let (_, user_agent, cookie) =
        build_crawler_client(None, &config, Some("Argument Agent".into())).unwrap();
    assert_eq!(user_agent, "Argument Agent");
    assert!(cookie.is_none());

    let (_, user_agent, _) = build_crawler_client(None, &config, None).unwrap();
    assert_eq!(user_agent, "SEOmi-Crawler/0.1 (Desktop SEO Auditor)");

    config.user_agent = Some("invalid\nuser-agent".into());
    assert_eq!(
        build_crawler_client(None, &config, None).unwrap_err(),
        "Invalid User-Agent value."
    );

    config.user_agent = Some("x".repeat(1_025));
    assert_eq!(
        build_crawler_client(None, &config, None).unwrap_err(),
        "User-Agent exceeds the 1024-character safety limit."
    );
}

#[test]
fn client_accepts_timeout_clamping_and_disabled_ssl_verification_options() {
    let mut config = default_crawl_config(None);
    config.request_timeout_secs = Some(0);
    config.verify_ssl = false;

    let (client, user_agent, cookie) = build_crawler_client(None, &config, None).unwrap();
    assert_eq!(user_agent, "SEOmi-Crawler/0.1 (Desktop SEO Auditor)");
    assert!(cookie.is_none());
    drop(client);
}

#[test]
fn browser_rendered_rejects_unsupported_profile_transports_and_skips_malformed_headers() {
    use super::super::setup_client::build_crawler_client_with_profile_loader;
    use crate::commands::settings::{CrawlAuthProfile, CrawlProfileHeader};

    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    config.request_profile_id = Some("profile-headers".into());

    let err = build_crawler_client_with_profile_loader(
        Some("p1"),
        &config,
        None,
        |_project, _profile| {
            Ok(CrawlAuthProfile {
                headers: vec![CrawlProfileHeader {
                    name: "X-Custom".into(),
                    value: "v".into(),
                }],
                cookie: None,
                proxy_url: None,
            })
        },
    )
    .unwrap_err();
    assert!(err.contains("Browser-rendered crawl supports cookies from the selected profile only"));

    let mut http_config = default_crawl_config(None);
    http_config.request_profile_id = Some("profile-malformed".into());
    let (client, _, _) = build_crawler_client_with_profile_loader(
        Some("p1"),
        &http_config,
        None,
        |_project, _profile| {
            Ok(CrawlAuthProfile {
                headers: vec![
                    CrawlProfileHeader {
                        name: "invalid\0name".into(),
                        value: "valid_val".into(),
                    },
                    CrawlProfileHeader {
                        name: "Valid-Name".into(),
                        value: "invalid\nval".into(),
                    },
                ],
                cookie: None,
                proxy_url: None,
            })
        },
    )
    .unwrap();
    drop(client);
}
