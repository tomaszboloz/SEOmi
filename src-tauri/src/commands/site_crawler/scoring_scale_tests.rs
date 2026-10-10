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

fn scaled_warning_crawl(total: usize, affected: usize) -> Vec<CrawledPageSummary> {
    (0..total)
        .map(|index| {
            let issues: &[(&str, &str)] = if index < affected {
                &[("Warning", "Shared finding")]
            } else {
                &[]
            };
            page(&format!("https://example.test/{index}"), issues)
        })
        .collect()
}

#[test]
fn same_finding_ratio_has_the_same_score_at_each_crawl_scale() {
    let half_scores = [10, 100, 1000]
        .map(|total| score_pages(&scaled_warning_crawl(total, total / 2)).health_score);
    assert_eq!(half_scores, [95, 95, 95]);

    let pervasive_scores =
        [10, 100, 1000].map(|total| score_pages(&scaled_warning_crawl(total, total)).health_score);
    assert_eq!(pervasive_scores, [90, 90, 90]);
}

#[test]
fn cap_keeps_only_three_distinct_types_and_is_order_invariant() {
    let issues = [
        ("Warning", "First finding"),
        ("Warning", "Second finding"),
        ("Warning", "Third finding"),
        ("Warning", "Fourth finding"),
    ];
    let pages = (0..10)
        .map(|index| page(&format!("https://example.test/{index}"), &issues))
        .collect::<Vec<_>>();
    let reversed = pages.iter().rev().cloned().collect::<Vec<_>>();
    assert_eq!(capped_finding_share(&pages, "Warning"), 3.0);
    assert_eq!(score_pages(&pages).health_score, 70);
    assert_eq!(
        score_pages(&pages).health_score,
        score_pages(&reversed).health_score
    );
}

#[test]
fn repeated_occurrences_on_one_page_do_not_change_the_share() {
    let one = page("https://example.test/one", &[("Warning", "Shared finding")]);
    let repeated = page(
        "https://example.test/repeated",
        &[("Warning", "Shared finding"); 4],
    );
    assert_eq!(
        capped_finding_share(std::slice::from_ref(&one), "Warning"),
        1.0
    );
    assert_eq!(
        score_pages(std::slice::from_ref(&one)).health_score,
        score_pages(&[repeated]).health_score
    );
}
