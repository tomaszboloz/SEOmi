use super::page_fixture::*;
use super::*;

#[test]
fn page_signals_extract_observed_content_metadata_and_assets_without_target_checks() {
    let mut config = default_crawl_config(None);
    config.focus_phrase = Some("crawl evidence".into());
    let setup = setup(config);
    let mut state = state();
    let mut issues = Vec::new();
    let signals = signals(&data(HTML), &setup, &mut state, &mut issues);
    assert_eq!(signals.content.title.as_deref(), Some("Crawl evidence"));
    assert_eq!(signals.content.title_length, Some(14));
    assert_eq!(signals.content.document_language.as_deref(), Some("en"));
    assert_eq!(signals.content.h1_count, 1);
    assert_eq!(signals.content.heading_counts, vec![1, 2, 0, 0, 0, 0]);
    assert_eq!(signals.content.duplicate_headings.len(), 1);
    assert!(signals.content.has_primary_content_root);
    assert!(signals.content.word_count > 50);
    assert!(signals.content.content_hash.is_some());
    assert!(signals.content.content_simhash.is_some());
    assert_eq!(signals.cm.word_count, signals.content.word_count);
    assert!(signals.cm.sentence_count.unwrap() >= 5);
    let phrase = signals.focus_phrase.unwrap();
    assert_eq!(phrase.phrase, "crawl evidence");
    assert_eq!(phrase.title_occurrences, 1);
    assert_eq!(phrase.meta_description_occurrences, 1);
    assert_eq!(phrase.h1_occurrences, 1);
    assert!(phrase.body_occurrences >= 2);
    assert_eq!(signals.meta.canonical.as_deref(), Some(FINAL_URL));
    assert_eq!(signals.meta.canonical_declaration_count, 1);
    assert_eq!(
        signals.extra.amp_url.as_deref(),
        Some("https://example.test/article/amp")
    );
    assert_eq!(signals.extra.schema_types, vec!["Article"]);
    assert_eq!(signals.extra.schema_syntax_errors, 0);
    assert_eq!(signals.extra.hreflangs[0].language, "pl");
    assert!(!signals.extra.hreflangs[0].target_checked_in_run);
    assert_eq!(signals.extra.pagination_declaration_count, 1);
    assert_eq!(signals.extra.pagination_invalid_declaration_count, 0);
    assert_eq!(
        signals.extra.pagination_next.as_deref(),
        Some("https://example.test/article?page=2")
    );
    assert!(!signals.extra.pagination_links[0].checked_in_run);
    assert_eq!(signals.extra.frames.len(), 1);
    assert_eq!(
        signals.extra.favicons,
        vec!["https://example.test/favicon.ico"]
    );
    assert_eq!(
        (
            signals.links.internal_link_count,
            signals.links.external_link_count
        ),
        (3, 1)
    );
    assert_eq!(signals.links.semantic_links.len(), 2);
    assert_eq!(signals.images.len(), 1);
    assert!(signals
        .links
        .links
        .iter()
        .all(|link| link.target_http_status.is_none()));
    assert!(state
        .queue
        .iter()
        .any(|(url, depth)| url == "https://example.test/next" && *depth == 3));
    assert!(!state
        .queue
        .iter()
        .any(|(url, _)| url.ends_with("/nofollow")));
    assert!(issues
        .iter()
        .any(|issue| issue.message.contains("Repeated heading text")));
}

#[test]
fn incomplete_or_non_html_bodies_do_not_produce_semantic_or_asset_evidence() {
    for kind in ["truncated", "read-failed", "non-html"] {
        let mut page_data = data(HTML);
        page_data.body_truncated = kind == "truncated";
        page_data.body_read_failed = kind == "read-failed";
        page_data.declared_html = kind != "non-html";
        let mut state = state();
        let signals = signals(
            &page_data,
            &setup(default_crawl_config(None)),
            &mut state,
            &mut Vec::new(),
        );
        assert_eq!(signals.content.word_count, 0);
        assert!(signals.content.title.is_none() && signals.content.meta_description.is_none());
        assert!(
            signals.content.content_hash.is_none() && signals.content.content_simhash.is_none()
        );
        assert!(
            signals.content.semantic_terms.is_empty()
                && signals.content.semantic_excerpts.is_empty()
        );
        assert!(signals.focus_phrase.is_none());
        assert!(signals.cm.sentence_count.is_none());
        assert!(signals.links.links.is_empty() && signals.images.is_empty());
        assert!(signals.meta.canonical.is_none());
        assert!(signals.extra.schema_types.is_empty() && signals.extra.frames.is_empty());
        assert!(signals.extra.html_validation_findings.is_empty());
        assert!(signals.content.document_language.is_none());
        assert_eq!(signals.content.h1_count, 0);
        assert!(signals.extra.hreflangs.is_empty() && signals.extra.pagination_links.is_empty());
        assert!(signals.extra.amp_url.is_none());
        assert!(state.queue.is_empty() && state.resource_candidates.is_empty());
    }
}
