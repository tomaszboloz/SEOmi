use super::*;

fn page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 40, "schema_types": [], "schema_syntax_errors": 0,
        "hreflangs": [], "h1_count": 0, "heading_counts": [0, 0, 0, 0, 0, 0],
        "internal_link_count": 0, "external_link_count": 0,
        "links": [], "images": [], "issues_count": 0, "issues": [],
        "content_hash": "same-hash", "content_simhash": "0000000000000001"
    }))
    .unwrap()
}

#[test]
fn identical_content_hash_pairs_are_not_reported_as_near_duplicates() {
    let mut pages = vec![page("https://e.test/a"), page("https://e.test/b")];
    annotate_duplicates(&mut pages);
    for page in &pages {
        assert!(page
            .issues
            .iter()
            .any(|issue| issue.message.contains("Duplicate normalized page content")));
        assert!(!page
            .issues
            .iter()
            .any(|issue| issue.message.contains("Near-duplicate")));
    }
}
