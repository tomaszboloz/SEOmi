use super::super::page_assembler::assemble_page_summary;
use super::super::page_status_issues::check_page_status_issues;
use super::page_fixture::*;
use super::*;
use crate::commands::site_crawler::fetch_types::{FetchedPageBody, FetchedResponse};

pub(super) fn rendered_config() -> CrawlConfig {
    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    config
}

fn status_issues(
    page_data: &super::super::super::fetch_types::FetchedPageData,
    final_url: &str,
    redirects: usize,
) -> Vec<String> {
    let mut issues = Vec::new();
    check_page_status_issues(
        page_data,
        final_url,
        CURRENT_URL,
        redirects,
        None,
        &rendered_config(),
        &mut issues,
    );
    issues
        .into_iter()
        .map(|issue| format!("{}: {}", issue.severity, issue.message))
        .collect()
}

#[test]
fn page_that_navigates_itself_is_noted_only_without_an_http_redirect() {
    let mut page_data = data("");
    page_data.rendered_diagnostics = Some((Vec::new(), Vec::new()));
    let moved = status_issues(&page_data, FINAL_URL, 0);
    assert_eq!(moved.len(), 1);
    assert!(moved[0].starts_with("Info: The page navigated to a different URL in the browser"));
    // An HTTP redirect explains the different URL; hops are already listed.
    let redirected = status_issues(&page_data, FINAL_URL, 1);
    assert_eq!(redirected, vec!["Info: Safely followed 1 redirect(s)"]);
    assert!(status_issues(&page_data, CURRENT_URL, 0).is_empty());
    // Raw HTML was analyzed, so the browser never navigated anywhere.
    page_data.rendered_diagnostics = None;
    assert!(status_issues(&page_data, FINAL_URL, 0).is_empty());
}

#[test]
fn render_fallback_is_a_page_warning_carrying_the_reason() {
    let mut page_data = data("");
    page_data.render_fallback = Some("Rendered page capture timed out after 60 seconds.".into());
    assert_eq!(
        status_issues(&page_data, CURRENT_URL, 0),
        vec!["Warning: Browser rendering failed; the raw HTML response was analyzed instead: Rendered page capture timed out after 60 seconds."]
    );
}

pub(super) async fn assembled(
    page_data: super::super::super::fetch_types::FetchedPageData,
    state: &mut CrawlLoopState,
) {
    let fetched = FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(page_data)),
        final_url: FINAL_URL.into(),
        redirect_chain: Vec::new(),
        redirect_stopped_reason: None,
        request_duration_ms: None,
        retry_count: 0,
    };
    let selectors = CrawlSelectors::compile();
    assemble_page_summary(
        fetched,
        1,
        FINAL_URL,
        0,
        &selectors,
        &setup(rendered_config()),
        state,
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn rendered_page_with_http_headers_gets_a_definite_indexability_verdict() {
    let mut state = state();
    let mut page_data = data(HTML);
    page_data.rendered_diagnostics = Some((Vec::new(), Vec::new()));
    page_data.x_robots_tag = Some("noindex".into());
    assembled(page_data, &mut state).await;
    let mut bare = data(HTML);
    bare.response_headers_available = false;
    assembled(bare, &mut state).await;

    let paired = &state.pages[0];
    assert_eq!(paired.indexability_status, "Excluded by robots directive");
    let decision = paired.robots_decision.as_ref().unwrap();
    assert!(decision.response_headers_available && decision.indexability == "noindex");
    let verdict = paired.indexability_verdict.as_ref().unwrap();
    assert_eq!(verdict.status, "blocked");
    assert!(!verdict
        .reasons
        .contains(&"x_robots_header_unavailable".to_string()));

    let bare = &state.pages[1];
    assert_eq!(
        bare.indexability_status,
        "Rendered DOM checked; X-Robots-Tag response header unavailable"
    );
    assert!(
        !bare
            .robots_decision
            .as_ref()
            .unwrap()
            .response_headers_available
    );
    assert_eq!(
        bare.indexability_verdict.as_ref().unwrap().status,
        "uncertain"
    );
}

#[tokio::test]
async fn assembling_pages_tracks_renderer_health_for_the_crawl_summary() {
    let mut state = state();
    for _ in 0..5 {
        let mut page_data = data(HTML);
        page_data.render_fallback = Some("Unable to create isolated renderer".into());
        assembled(page_data, &mut state).await;
    }
    assert_eq!(state.render_health.fallback_pages, 5);
    assert!(!state.render_health.rendering_enabled());
    assert!(state.pages.iter().all(|page| page
        .issues
        .iter()
        .any(|issue| issue.severity == "Warning"
            && issue.message.starts_with("Browser rendering failed"))));
}
