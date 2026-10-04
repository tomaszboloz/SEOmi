use super::super::setup_config::{default_crawl_config, resolve_resume_urls};
use super::*;

#[test]
fn defaults_preserve_safe_crawl_transport_and_resource_bounds() {
    let config = default_crawl_config(Some(17));
    assert_eq!(config.max_pages, Some(17));
    assert_eq!(config.crawl_mode, "http");
    assert!(config.respect_robots && config.respect_crawl_delay && config.verify_ssl);
    assert!(config.discover_sitemaps);
    assert!(!config.allow_subdomains && !config.list_mode && !config.follow_nofollow);
    assert_eq!(config.max_response_bytes, Some(5_000_000));
    assert_eq!(config.max_run_seconds, Some(300));
    assert_eq!(config.max_resource_requests, Some(250));
    assert_eq!(config.max_concurrent_requests, Some(4));
    assert!(config.request_profile_id.is_none() && config.user_agent.is_none());
}

#[test]
fn setup_applies_config_precedence_clamps_bounds_and_trims_unicode_focus_phrase() {
    let mut config = default_crawl_config(Some(500_000));
    config.max_depth = Some(999);
    config.max_redirects = Some(999);
    config.max_response_bytes = Some(1);
    config.max_run_seconds = Some(0);
    config.focus_phrase = Some(format!("  {}  ", "ż".repeat(170)));
    config.user_agent = Some("Configured Agent".into());
    let setup = CrawlSetup::init(
        "https://example.test/".into(),
        Some(9),
        Some("Argument Agent".into()),
        Some("explicit-run".into()),
        None,
        Some(config),
        &CrawlControl::new(),
    )
    .unwrap();
    assert_eq!(
        (
            setup.limit,
            setup.max_depth,
            setup.max_redirects,
            setup.max_response_bytes
        ),
        (10_000, 100, 50, 1_024)
    );
    assert_eq!(setup.max_run_seconds, Some(1));
    assert_eq!(
        setup.config.focus_phrase.as_ref().unwrap().chars().count(),
        160
    );
    assert_eq!(setup.config.focus_phrase.unwrap(), "ż".repeat(160));
    assert_eq!(setup.ua, "Configured Agent");
    assert_eq!(setup.run_id, "explicit-run");
    assert!(setup.rendered_cookie.is_none());
}

#[test]
fn setup_uses_argument_defaults_generates_run_id_and_discards_blank_focus() {
    let control = CrawlControl::new();
    let setup = CrawlSetup::init(
        "https://example.test/".into(),
        Some(0),
        None,
        None,
        None,
        None,
        &control,
    )
    .unwrap();
    assert_eq!(setup.limit, 1);
    assert_eq!(setup.max_depth, 100);
    assert!(uuid::Uuid::parse_str(&setup.run_id).is_ok());
    assert!(!control.is_paused(&setup.run_id));
    let mut config = default_crawl_config(None);
    config.focus_phrase = Some("   ".into());
    config.max_response_bytes = Some(usize::MAX);
    config.max_run_seconds = Some(u64::MAX);
    let setup = super::setup(config);
    assert!(setup.config.focus_phrase.is_none());
    assert_eq!(setup.max_response_bytes, 50_000_000);
    assert_eq!(setup.max_run_seconds, Some(3_600));
}

#[test]
fn resume_normalization_deduplicates_completed_scoped_urls_and_skips_them_in_frontier() {
    let mut config = default_crawl_config(None);
    config.resume_completed_urls = vec![
        "https://example.test/done#one".into(),
        "https://example.test/done#two".into(),
        "https://other.test/done".into(),
        "http://127.0.0.1/private".into(),
        "https://[broken".into(),
    ];
    config.resume_frontier_urls = vec![
        "https://example.test/done".into(),
        "https://example.test/pending#fragment".into(),
        "https://[broken".into(),
    ];
    let (completed, frontier) = resolve_resume_urls(&config, "example.test");
    assert_eq!(
        completed.into_iter().collect::<Vec<_>>(),
        vec!["https://example.test/done".to_string()]
    );
    assert_eq!(frontier, vec!["https://example.test/pending".to_string()]);
}
