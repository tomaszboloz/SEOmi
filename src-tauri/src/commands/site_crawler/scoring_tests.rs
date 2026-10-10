use super::*;

fn page(url: &str, issues: &[(&str, &str)]) -> CrawledPageSummary {
    let issues = issues
        .iter()
        .map(|(severity, message)| {
            serde_json::json!({
                "severity": severity,
                "message": message,
            })
        })
        .collect::<Vec<_>>();
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 0, "schema_types": [],
        "schema_syntax_errors": 0, "hreflangs": [], "h1_count": 0,
        "heading_counts": [0, 0, 0, 0, 0, 0], "internal_link_count": 0,
        "external_link_count": 0, "links": [], "images": [],
        "issues_count": issues.len(), "issues": issues
    }))
    .unwrap()
}

#[test]
fn score_uses_page_share_and_retains_raw_occurrences() {
    let pages = (0..10)
        .map(|index| {
            page(
                &format!("https://example.test/{index}"),
                &[("Warning", "Repeated finding")],
            )
        })
        .collect::<Vec<_>>();
    let score = score_pages(&pages);
    assert_eq!(score.warning_count, 10);
    assert_eq!(score.health_score, 90);
}

#[test]
fn score_counts_distinct_types_and_caps_each_type_deterministically() {
    let pages = (0..10)
        .map(|index| {
            page(
                &format!("https://example.test/{index}"),
                &[
                    ("Warning", "Repeated finding"),
                    ("Warning", "Other finding"),
                ],
            )
        })
        .collect::<Vec<_>>();
    let reversed = pages.iter().rev().cloned().collect::<Vec<_>>();
    assert_eq!(score_pages(&pages).warning_count, 20);
    assert_eq!(score_pages(&pages).health_score, 80);
    assert_eq!(
        score_pages(&pages).health_score,
        score_pages(&reversed).health_score
    );
}

#[test]
fn score_is_ratio_invariant_before_a_type_reaches_the_page_cap() {
    let small = (0..10)
        .map(|index| {
            page(
                &format!("https://example.test/small-{index}"),
                if index == 0 {
                    &[("Warning", "Repeated finding")]
                } else {
                    &[]
                },
            )
        })
        .collect::<Vec<_>>();
    let large = (0..20)
        .map(|index| {
            page(
                &format!("https://example.test/large-{index}"),
                if index < 2 {
                    &[("Warning", "Repeated finding")]
                } else {
                    &[]
                },
            )
        })
        .collect::<Vec<_>>();
    assert_eq!(score_pages(&small).health_score, 99);
    assert_eq!(
        score_pages(&small).health_score,
        score_pages(&large).health_score
    );

    let one = page(
        "https://example.test/one",
        &[("Warning", "Repeated finding")],
    );
    let repeated = page(
        "https://example.test/repeated",
        &[("Warning", "Repeated finding"); 3],
    );
    assert_eq!(
        score_pages(&[one]).health_score,
        score_pages(&[repeated]).health_score
    );
}

#[test]
fn score_normalizes_dynamic_suffixes_as_one_finding_type() {
    let pages = vec![
        page(
            "https://example.test/a",
            &[("Critical", "HTTP error status 404")],
        ),
        page(
            "https://example.test/b",
            &[("Critical", "HTTP error status 500")],
        ),
        page(
            "https://example.test/c",
            &[("Critical", "HTTP error status 503")],
        ),
        page(
            "https://example.test/d",
            &[("Critical", "HTTP error status 401")],
        ),
    ];
    assert_eq!(capped_finding_share(&pages, "Critical"), 1.0);
    assert_eq!(score_pages(&pages).critical_count, 4);
    assert_eq!(score_pages(&pages).health_score, 80);
}

#[test]
fn empty_crawl_is_evidence_limited_and_finding_key_is_stable() {
    assert_eq!(score_pages(&[]).health_score, 50);
    assert_eq!(finding_type(" Duplicate title: /one "), "duplicate title");
    assert_eq!(finding_type("HTTP error status 404"), "http error status #");
}

#[test]
fn no_html_or_partial_evidence_cannot_look_fully_healthy() {
    let mut binary = page("https://example.test/file.zip", &[]);
    binary.content_type = Some("application/zip".into());
    assert_eq!(score_pages(&[binary]).health_score, 50);

    let mut partial = page("https://example.test/partial", &[]);
    partial.body_truncated = true;
    assert_eq!(score_pages(&[partial]).health_score, 90);
}
