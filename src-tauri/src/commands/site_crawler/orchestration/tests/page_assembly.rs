use super::super::super::fetch_types::{FetchedPageBody, FetchedResponse};
use super::super::page_assembler::assemble_page_summary;
use super::page_fixture::*;
use super::*;

fn fetched(page_data: super::super::super::fetch_types::FetchedPageData) -> FetchedResponse {
    FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(page_data)),
        final_url: FINAL_URL.into(),
        redirect_chain: vec![hop()],
        redirect_stopped_reason: None,
    }
}

#[tokio::test]
async fn assembler_uses_prefetched_body_and_moves_only_matching_discovery() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    state
        .discovery_sources_by_url
        .insert(CURRENT_URL.into(), vec![source("resume")]);
    state
        .discovery_sources_by_url
        .insert("https://example.test/other".into(), vec![source("link")]);
    assemble_page_summary(
        fetched(data(HTML)),
        43,
        CURRENT_URL,
        2,
        &CrawlSelectors::compile(),
        &setup,
        &mut state,
    )
    .await
    .unwrap();
    assert_eq!(state.pages.len(), 1);
    let page = &state.pages[0];
    assert_eq!(page.title.as_deref(), Some("Crawl evidence"));
    assert_eq!(page.response_time_ms, 43);
    assert_eq!(page.detected_charset.as_deref(), Some("UTF-8"));
    assert_eq!(page.discovery_sources, vec![source("resume")]);
    assert!(!state.discovery_sources_by_url.contains_key(CURRENT_URL));
    assert!(state
        .discovery_sources_by_url
        .contains_key("https://example.test/other"));
    assert_eq!(page.issues_count, page.issues.len());
}

#[tokio::test]
async fn assembler_prefers_observed_browser_navigation_time_including_zero() {
    for navigation_time in [0, 127] {
        let mut page_data = data(HTML);
        page_data.browser_navigation_time_ms = Some(navigation_time);
        page_data.rendered_lcp_ms = Some(321);
        let mut config = default_crawl_config(None);
        config.crawl_mode = "browser-rendered".into();
        let mut state = state();
        assemble_page_summary(
            fetched(page_data),
            999,
            CURRENT_URL,
            0,
            &CrawlSelectors::compile(),
            &setup(config),
            &mut state,
        )
        .await
        .unwrap();
        assert_eq!(state.pages[0].response_time_ms, navigation_time);
        assert_eq!(state.pages[0].rendered_lcp_ms, Some(321));
        assert_eq!(state.pages[0].semantic_content_provenance, "rendered");
    }
}

#[tokio::test]
async fn invalid_final_url_returns_error_without_mutating_crawl_state() {
    let mut response = fetched(data(HTML));
    response.final_url = "https://[broken".into();
    let mut state = state();
    state
        .discovery_sources_by_url
        .insert(CURRENT_URL.into(), vec![source("link")]);
    let error = assemble_page_summary(
        response,
        43,
        CURRENT_URL,
        0,
        &CrawlSelectors::compile(),
        &setup(default_crawl_config(None)),
        &mut state,
    )
    .await
    .unwrap_err();
    assert!(error.starts_with("Failed to parse final URL:"));
    assert!(
        state.pages.is_empty() && state.queue.is_empty() && state.resource_candidates.is_empty()
    );
    assert_eq!(
        state.discovery_sources_by_url[CURRENT_URL],
        vec![source("link")]
    );
}
