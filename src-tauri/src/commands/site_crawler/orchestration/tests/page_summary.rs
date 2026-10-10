use super::page_fixture::*;
use super::*;

#[test]
fn successful_summary_retains_request_identity_and_observed_render_metrics() {
    let mut page_data = data(HTML);
    page_data.rendered_diagnostics = Some((Vec::new(), Vec::new()));
    page_data.rendered_lcp_ms = Some(0);
    page_data.rendered_inp_ms = Some(27);
    page_data.rendered_cls = Some(0.125);
    let mut issues = Vec::new();
    let signals = signals(
        &page_data,
        &setup(default_crawl_config(None)),
        &mut state(),
        &mut issues,
    );
    let issue_count = issues.len();
    let page = summary(&page_data, signals, issues, "browser-rendered");
    assert_eq!(
        (page.url.as_str(), page.final_url.as_str()),
        (CURRENT_URL, FINAL_URL)
    );
    assert_eq!(
        (page.depth, page.http_status, page.response_time_ms),
        (2, 200, 83)
    );
    assert_eq!(page.redirect_chain[0].http_status, 301);
    assert_eq!(page.redirect_chain[0].response_time_ms, Some(17));
    assert_eq!(page.redirect_stop_reason.as_deref(), Some("observed-stop"));
    assert_eq!(page.discovery_sources, vec![source("resume")]);
    assert_eq!(page.rendered_lcp_ms, Some(0));
    assert_eq!(page.rendered_inp_ms, Some(27));
    assert_eq!(page.rendered_cls, Some(0.125));
    assert_eq!(page.semantic_content_provenance, "rendered");
    assert!(page.semantic_content_partial);
    assert_eq!(page.content_length, Some(HTML.len() as u64));
    assert_eq!(page.content_type.as_deref(), Some("text/html"));
    assert_eq!(page.content_encoding.as_deref(), Some("gzip"));
    assert_eq!(page.cache_control.as_deref(), Some("max-age=60"));
    assert_eq!(page.charset.as_deref(), Some("utf-8"));
    assert_eq!(page.detected_charset.as_deref(), Some("UTF-8"));
    assert_eq!(page.issues_count, issue_count);
    assert_eq!(page.issues_count, page.issues.len());
    assert!(page.request_error_kind.is_none());
    assert_eq!(page.title.as_deref(), Some("Crawl evidence"));
    assert_eq!(page.schema_types, vec!["Article"]);
    assert_eq!(page.images.len(), 1);
    assert!(page.amp_target_http_status.is_none());
    assert!(!page.amp_target_checked_in_run);
    assert!(page.amp_target_canonical_alignment.is_none());
}

#[test]
fn summary_preserves_measured_readability_and_unknown_http_render_metrics() {
    let page_data = data(HTML);
    let mut config = default_crawl_config(None);
    config.focus_phrase = Some("crawl evidence".into());
    let signals = signals(&page_data, &setup(config), &mut state(), &mut Vec::new());
    let sentence_count = signals.cm.sentence_count;
    let terms = signals.cm.content_terms.clone();
    let hash = signals.content.content_hash.clone();
    let page = summary(&page_data, signals, Vec::new(), "http");
    assert_eq!(page.semantic_content_provenance, "http");
    assert!(
        page.rendered_lcp_ms.is_none()
            && page.rendered_inp_ms.is_none()
            && page.rendered_cls.is_none()
    );
    assert_eq!(page.sentence_count, sentence_count);
    assert_eq!(page.content_terms, terms);
    assert_eq!(page.content_hash, hash);
    assert!(page.average_words_per_sentence.unwrap() > 0.0);
    assert!(page.average_characters_per_word.unwrap() > 0.0);
    assert!(page.complexity_score.is_some() && page.complexity_label.is_some());
    assert!(page.readability_ease_score.is_some() && page.readability_grade.is_some());
    assert!(page.readability_method.is_some() && page.readability_label.is_some());
    assert_eq!(page.focus_phrase.unwrap().phrase, "crawl evidence");
    assert_eq!(page.h1_count, 1);
    assert_eq!(page.heading_counts, vec![1, 2, 0, 0, 0, 0]);
    assert_eq!(page.duplicate_headings.len(), 1);
    assert_eq!((page.internal_link_count, page.external_link_count), (3, 1));
    assert_eq!(page.links.len(), 4);
    assert_eq!(page.semantic_links.len(), 2);
    assert_eq!(page.frames.len(), 1);
    assert_eq!(page.hreflangs.len(), 1);
}

#[test]
fn summary_marks_incomplete_bodies_without_inventing_semantic_provenance() {
    for kind in ["truncated", "read-failed"] {
        let mut page_data = data(HTML);
        page_data.body_truncated = kind == "truncated";
        page_data.body_read_failed = kind == "read-failed";
        let signals = signals(
            &page_data,
            &setup(default_crawl_config(None)),
            &mut state(),
            &mut Vec::new(),
        );
        let page = summary(&page_data, signals, Vec::new(), "browser-rendered");
        assert!(page.semantic_content_partial);
        assert_eq!(page.body_truncated, kind == "truncated");
        assert_eq!(page.semantic_content_provenance, "unavailable");
        assert!(page.semantic_terms.is_empty() && page.semantic_links.is_empty());
    }
}

#[test]
fn summary_marks_raw_html_fallback_as_http_provenance() {
    let mut page_data = data(HTML);
    page_data.render_fallback = Some("renderer unavailable".into());
    let signals = signals(
        &page_data,
        &setup(default_crawl_config(None)),
        &mut state(),
        &mut Vec::new(),
    );
    let page = summary(&page_data, signals, Vec::new(), "browser-rendered");
    assert_eq!(page.semantic_content_provenance, "http");
}

#[test]
fn complete_short_document_has_no_partial_marker() {
    let page_data = data("<html lang='en'><title>Evidence</title><main><h1>Evidence</h1><p>Observed text.</p></main></html>");
    let signals = signals(
        &page_data,
        &setup(default_crawl_config(None)),
        &mut state(),
        &mut Vec::new(),
    );
    let page = summary(&page_data, signals, Vec::new(), "http");
    assert!(!page.semantic_content_partial);
    assert_eq!(page.semantic_content_provenance, "http");
    assert_eq!(page.semantic_content_source, "primary-root");
}
