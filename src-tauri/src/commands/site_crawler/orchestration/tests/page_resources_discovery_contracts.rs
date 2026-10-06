use super::super::super::models::CrawledFrame;
use super::super::page_resources_discovery::{
    register_page_resource_candidates, RegisterPageResourceCandidatesInput,
};
use super::super::setup_config::default_crawl_config;
use super::*;
use scraper::{Html, Selector};
use url::Url;

#[test]
fn resource_discovery_skips_missing_attributes_and_classifies_page_assets() {
    let mut config = default_crawl_config(None);
    config.crawl_scripts = true;
    config.crawl_stylesheets = true;
    config.crawl_other_resources = true;
    let setup = setup(config);
    let document = Html::parse_document(
        r#"<script></script><script src="/app.js"></script>
           <link rel="STYLESHEET" href="/main.css"><link rel="icon" href="/favicon.ico">
           <link rel="stylesheet"><video></video><video src="/movie.mp4"></video>"#,
    );
    let script_selector = Selector::parse("script").unwrap();
    let link_selector = Selector::parse("link").unwrap();
    let media_selector = Selector::parse("video").unwrap();
    let frames = vec![
        CrawledFrame {
            src: Some("/frame".into()),
            resolved_url: Some("https://example.test/frame".into()),
            title: None,
            name: None,
            loading: None,
            sandbox: None,
            checked_in_run: false,
            http_status: None,
            request_error_kind: None,
        },
        CrawledFrame {
            src: Some("/unresolved".into()),
            resolved_url: None,
            title: None,
            name: None,
            loading: None,
            sandbox: None,
            checked_in_run: false,
            http_status: None,
            request_error_kind: None,
        },
    ];
    let final_base = Url::parse("https://example.test/base/").unwrap();
    let mut state = state();
    register_page_resource_candidates(RegisterPageResourceCandidatesInput {
        document: &document,
        final_base: &final_base,
        final_url: "https://example.test/page",
        frames: &frames,
        script_src_selector: &script_selector,
        link_href_selector: &link_selector,
        media_src_selector: &media_selector,
        setup: &setup,
        state: &mut state,
    });

    assert_eq!(state.resource_candidates.len(), 5);
    assert_eq!(
        state.resource_candidates["https://example.test/app.js"].resource_type,
        "script"
    );
    assert_eq!(
        state.resource_candidates["https://example.test/main.css"].resource_type,
        "stylesheet"
    );
    assert_eq!(
        state.resource_candidates["https://example.test/favicon.ico"].resource_type,
        "other"
    );
    assert_eq!(
        state.resource_candidates["https://example.test/movie.mp4"].resource_type,
        "other"
    );
    assert_eq!(
        state.resource_candidates["https://example.test/frame"].source_urls,
        vec!["https://example.test/page"]
    );
}
