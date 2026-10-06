use super::*;

fn page(url: &str, hash: &str, signature: Option<&str>, words: usize) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": words, "schema_types": [], "schema_syntax_errors": 0,
        "hreflangs": [], "h1_count": 0, "heading_counts": [0, 0, 0, 0, 0, 0],
        "internal_link_count": 0, "external_link_count": 0, "links": [], "images": [],
        "content_hash": hash, "content_simhash": signature,
        "issues_count": 1, "issues": [{"severity": "Info", "message": "Existing finding"}]
    }))
    .unwrap()
}

#[test]
fn near_duplicate_findings_name_both_pages_and_preserve_existing_issues() {
    let mut pages = vec![
        page("https://example.test/a", "a", Some("0000000000000000"), 20),
        page("https://example.test/b", "b", Some("000000000000007f"), 20),
    ];
    annotate_duplicates(&mut pages);
    for (index, counterpart) in ["https://example.test/b", "https://example.test/a"]
        .into_iter()
        .enumerate()
    {
        assert_eq!(pages[index].issues_count, 2);
        assert_eq!(pages[index].issues[0].message, "Existing finding");
        assert_eq!(pages[index].issues[1].severity, "Warning");
        assert_eq!(pages[index].issues[1].message,
            format!("Near-duplicate content with {counterpart} (local SimHash distance 7/64; threshold ≤7)"));
    }
}

#[test]
fn insufficient_text_missing_signatures_and_distance_eight_do_not_create_findings() {
    for candidate in [
        page("https://example.test/b", "b", Some("0000000000000000"), 19),
        page("https://example.test/b", "b", None, 20),
        page("https://example.test/b", "b", Some("00000000000000ff"), 20),
    ] {
        let mut pages = vec![
            page("https://example.test/a", "a", Some("0000000000000000"), 20),
            candidate,
        ];
        annotate_duplicates(&mut pages);
        for page in pages {
            assert_eq!(page.issues_count, 1);
            assert_eq!(page.issues.len(), 1);
            assert_eq!(page.issues[0].message, "Existing finding");
        }
    }
}

#[test]
fn exact_fingerprints_are_reported_without_an_additional_near_duplicate_warning() {
    let mut pages = vec![
        page(
            "https://example.test/a",
            "same",
            Some("0000000000000000"),
            20,
        ),
        page(
            "https://example.test/b",
            "same",
            Some("0000000000000001"),
            20,
        ),
    ];
    annotate_duplicates(&mut pages);
    for page in pages {
        assert_eq!(page.issues_count, 2);
        assert_eq!(page.issues.len(), 2);
        assert_eq!(
            page.issues[1].message,
            "Duplicate normalized page content found in this crawl"
        );
        assert_eq!(page.issues[1].severity, "Warning");
    }
}
