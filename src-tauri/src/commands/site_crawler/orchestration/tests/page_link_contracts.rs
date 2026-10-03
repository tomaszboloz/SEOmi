use super::super::page_links::{extract_page_links, ExtractPageLinksInput, PageLinksOutcome};
use super::*;
use scraper::{Html, Selector};
use url::Url;

fn links(html: &str, config: CrawlConfig, state: &mut CrawlLoopState) -> PageLinksOutcome {
    extract_page_links(ExtractPageLinksInput {
        document: &Html::parse_document(html),
        final_base: &Url::parse("https://example.test/article").unwrap(),
        final_url: "https://example.test/article",
        depth: 0,
        has_primary_content_root: true,
        a_selector: &Selector::parse("a").unwrap(),
        setup: &setup(config),
        state,
    })
}

#[test]
fn link_extractor_rejects_non_http_invalid_and_non_navigation_declarations() {
    let html = r##"<main><a>No target</a><a href="#fragment">Fragment</a>
        <a href="javascript:alert(1)">Script</a><a href="mailto:user@example.test">Mail</a>
        <a href="tel:123">Telephone</a><a href="https://[broken">Broken</a>
        <a href="/inside?q=1#part" rel="nofollow external">  Observed <b>anchor</b> </a>
        <a href="https://outside.test/page">External</a></main>"##;
    let mut state = state();
    let result = links(html, default_crawl_config(None), &mut state);
    assert_eq!(
        (result.internal_link_count, result.external_link_count),
        (1, 1)
    );
    assert_eq!(result.links.len(), 2);
    assert_eq!(result.semantic_links.len(), 1);
    let link = &result.links[0];
    assert_eq!(link.target_url, "https://example.test/inside");
    assert_eq!(link.anchor_text, "Observed anchor");
    assert_eq!(link.rel.as_deref(), Some("nofollow external"));
    assert!(link.is_internal);
    assert!(link.source_excerpt.as_deref().unwrap().contains("Observed"));
    assert!(link.target_http_status.is_none() && link.target_checked_at.is_none());
    assert!(state.queue.is_empty());
    let source = &state.discovery_sources_by_url[&link.target_url][0];
    assert_eq!(source.kind, "link");
    assert_eq!(source.anchor_text.as_deref(), Some("Observed anchor"));
}

#[test]
fn link_extractor_caps_evidence_but_keeps_observed_counts_and_resource_discovery() {
    let html = format!(
        "<main>{}<a href='/document.pdf'>Download</a></main>",
        (0..5001)
            .map(|i| format!("<a href='/page/{i}'>Target {i}</a>"))
            .collect::<String>()
    );
    let mut config = default_crawl_config(Some(1));
    config.crawl_other_resources = true;
    let mut state = state();
    let result = links(&html, config, &mut state);
    assert_eq!(result.internal_link_count, 5002);
    assert_eq!(result.external_link_count, 0);
    assert_eq!(result.links.len(), 5000);
    assert_eq!(result.semantic_links.len(), 1000);
    assert_eq!(
        result.links.last().unwrap().target_url,
        "https://example.test/page/4999"
    );
    assert_eq!(
        result.semantic_links.last().unwrap().target_url,
        "https://example.test/page/999"
    );
    assert_eq!(state.queue.len(), 2);
    assert!(state
        .resource_candidates
        .values()
        .any(|r| r.url == "https://example.test/document.pdf"));
}

#[test]
fn follow_nofollow_and_depth_settings_control_frontier_without_losing_link_evidence() {
    for (follow, max_depth, queued, reached) in [
        (false, 1, false, false),
        (true, 1, true, false),
        (true, 0, false, true),
    ] {
        let mut config = default_crawl_config(None);
        config.follow_nofollow = follow;
        config.max_depth = Some(max_depth);
        let mut state = state();
        let result = links(
            "<main><a href='/next' rel='NOFOLLOW'>Next</a></main>",
            config,
            &mut state,
        );
        assert_eq!(result.links.len(), 1);
        assert_eq!(result.internal_link_count, 1);
        assert_eq!(state.queue.len(), usize::from(queued));
        assert_eq!(state.depth_limit_reached, reached);
    }
}

#[test]
fn plain_http_links_are_retained_as_external_observations() {
    let result = links(
        "<main><a href='http://outside.test/page'>HTTP source</a></main>",
        default_crawl_config(None),
        &mut state(),
    );
    assert_eq!(result.external_link_count, 1);
    assert_eq!(result.links[0].target_url, "http://outside.test/page");
    assert!(!result.links[0].is_internal);
    assert!(result.semantic_links.is_empty());
}
