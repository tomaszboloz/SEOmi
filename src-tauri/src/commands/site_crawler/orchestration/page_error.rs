use super::super::{
    fetch_types::CrawlFetchFailure,
    models::{CrawledDiscoverySource, CrawledPageIssue, CrawledPageSummary},
};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub fn handle_page_error(
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
    current_url: &str,
    depth: usize,
    page_duration: u64,
    e: CrawlFetchFailure,
) -> bool {
    if e.kind == "cancelled" {
        return false; // signals break
    }
    let issues = vec![CrawledPageIssue {
        severity: "Critical".into(),
        message: format!("Fetch failed: {}", e.message),
    }];
    let final_url = current_url.to_string();
    let is_start_url =
        !setup.config.list_mode && current_url == setup.normalized_start_url.to_string();
    let initial_discovery_sources = if is_start_url {
        vec![CrawledDiscoverySource {
            kind: "start".into(),
            source_url: None,
            anchor_text: None,
        }]
    } else if setup.config.list_mode {
        vec![CrawledDiscoverySource {
            kind: "seed".into(),
            source_url: None,
            anchor_text: None,
        }]
    } else {
        Vec::new()
    };
    let discovery_sources = state
        .discovery_sources_by_url
        .remove(current_url)
        .unwrap_or(initial_discovery_sources);
    state.pages.push(CrawledPageSummary {
        url: current_url.to_string(),
        final_url,
        discovery_sources,
        redirect_chain: Vec::new(),
        redirect_stop_reason: None,
        depth,
        http_status: 0,
        response_time_ms: page_duration,
        rendered_lcp_ms: None,
        rendered_inp_ms: None,
        rendered_cls: None,
        request_error_kind: Some(e.kind),
        title: None,
        title_length: None,
        meta_description: None,
        meta_description_length: None,
        canonical: None,
        canonical_targets: Vec::new(),
        canonical_declaration_count: 0,
        canonical_relation: "none".into(),
        canonical_robots_conflict: false,
        client_redirects: Vec::new(),
        meta_robots: None,
        x_robots_tag: None,
        robots_decision: None,
        indexability_verdict: None,
        indexability_status: "Uncertain".into(),
        content_type: None,
        content_length: None,
        content_encoding: None,
        charset: None,
        detected_charset: None,
        cache_control: None,
        body_truncated: false,
        word_count: 0,
        text_ratio_percent: None,
        reading_time_minutes: None,
        sentence_count: None,
        average_words_per_sentence: None,
        average_characters_per_word: None,
        complexity_score: None,
        complexity_label: None,
        readability_ease_score: None,
        readability_grade: None,
        readability_method: None,
        readability_label: None,
        content_terms: Vec::new(),
        focus_phrase: None,
        content_hash: None,
        content_simhash: None,
        semantic_terms: Vec::new(),
        semantic_excerpts: Vec::new(),
        semantic_links: Vec::new(),
        semantic_content_source: "none".into(),
        semantic_content_provenance: "none".into(),
        semantic_content_partial: false,
        schema_types: Vec::new(),
        schema_references: Vec::new(),
        schema_syntax_errors: 0,
        schema_validation_findings: Vec::new(),
        schema_validation_truncated: false,
        html_validation_findings: Vec::new(),
        html_validation_truncated: false,
        document_language: None,
        hreflangs: Vec::new(),
        amp_url: None,
        amp_target_http_status: None,
        amp_target_checked_in_run: false,
        amp_target_canonical_alignment: None,
        h1_count: 0,
        heading_counts: Vec::new(),
        duplicate_headings: Vec::new(),
        pagination_next: None,
        pagination_prev: None,
        pagination_links: Vec::new(),
        pagination_declaration_count: 0,
        pagination_invalid_declaration_count: 0,
        pagination_canonical_alignment: None,
        internal_link_count: 0,
        external_link_count: 0,
        links: Vec::new(),
        images: Vec::new(),
        frames: Vec::new(),
        frames_truncated: false,
        favicons: Vec::new(),
        favicon_metadata: Vec::new(),
        favicon_resource_checks: Vec::new(),
        social_meta_tags: Vec::new(),
        custom_search_results: Vec::new(),
        issues_count: issues.len(),
        issues,
    });
    true
}
