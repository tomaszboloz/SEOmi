use super::*;
use std::collections::HashMap;

fn page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 0, "schema_types": [], "schema_syntax_errors": 0,
        "hreflangs": [], "h1_count": 0, "heading_counts": [0, 0, 0, 0, 0, 0],
        "internal_link_count": 0, "external_link_count": 0,
        "links": [], "images": [], "issues_count": 0, "issues": []
    }))
    .unwrap()
}

#[test]
fn pagination_alignment_maps_every_canonical_relation() {
    for (relation, expected) in [
        ("self", Some("self-canonical")),
        ("missing", Some("missing-canonical")),
        ("multiple", Some("multiple-canonical")),
        ("invalid", Some("invalid-canonical")),
        ("unavailable", None),
        ("other", Some("canonical-points-elsewhere")),
    ] {
        assert_eq!(
            pagination_canonical_alignment(relation).as_deref(),
            expected
        );
    }
}

#[test]
fn amp_targets_with_zero_status_are_flagged_as_warnings() {
    let mut page = page("https://example.com/a");
    page.amp_url = Some("https://example.com/amp".into());
    let mut pages = [page];
    let statuses = HashMap::from([("https://example.com/amp".to_string(), 0u16)]);
    annotate_amp_targets(&mut pages, &statuses, &HashMap::new());
    assert!(pages[0]
        .issues
        .iter()
        .any(|issue| issue.severity == "Warning" && issue.message.contains("HTTP 0")));
}

#[test]
fn amp_targets_with_healthy_status_get_no_warning() {
    let mut page = page("https://example.com/a");
    page.amp_url = Some("https://example.com/amp".into());
    let mut pages = [page];
    let statuses = HashMap::from([("https://example.com/amp".to_string(), 200u16)]);
    annotate_amp_targets(&mut pages, &statuses, &HashMap::new());
    assert_eq!(pages[0].amp_target_http_status, Some(200));
    assert!(pages[0].issues.iter().all(|i| i.severity != "Warning"));
}
