use super::*;

#[test]
fn scoring_counts_severities_and_caps_penalties() {
    let empty = score_pages(&[]);
    assert_eq!(empty.health_score, 100);
    let mut page = post_processing_page("https://example.com");
    page.issues = vec![
        CrawledPageIssue {
            severity: "Critical".into(),
            message: "fixture".into(),
        },
        CrawledPageIssue {
            severity: "Warning".into(),
            message: "fixture".into(),
        },
        CrawledPageIssue {
            severity: "Info".into(),
            message: "fixture".into(),
        },
    ];
    let score = score_pages(&[page.clone()]);
    assert_eq!(
        (
            score.critical_count,
            score.warning_count,
            score.notice_count,
            score.health_score
        ),
        (1, 1, 1, 80)
    );
    assert_eq!(score_pages(&vec![page; 10]).health_score, 20);
}

#[test]
fn post_processing_duplicates_preserves_distinct_and_missing_titles() {
    let mut pages = vec![
        post_processing_page("https://example.com/a"),
        post_processing_page("https://example.com/b"),
    ];
    annotate_duplicates(&mut pages);
    assert!(pages.iter().all(|page| page.issues.is_empty()));
    for page in &mut pages {
        page.title = Some("Same title".into());
    }
    annotate_duplicates(&mut pages);
    assert!(pages.iter().all(|page| page
        .issues
        .iter()
        .any(|issue| issue.message.contains("Duplicate title"))));
    assert!(pages
        .iter()
        .all(|page| page.issues_count == page.issues.len()));
}

#[test]
fn post_processing_links_uses_observed_target_status_only() {
    let mut source = post_processing_page("https://example.com/a");
    source.links.push(
        serde_json::from_value(serde_json::json!({
            "target_url": "https://example.com/b", "anchor_text": "B", "is_internal": true
        }))
        .unwrap(),
    );
    let mut target = post_processing_page("https://example.com/b");
    target.http_status = 404;
    let mut pages = vec![source, target];
    annotate_page_relations(&mut pages, "http");
    assert_eq!(pages[0].links[0].target_http_status, Some(404));
    assert!(pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("internal link target")));
}

#[test]
fn legacy_crawl_snapshots_default_to_http_mode() {
    let legacy = serde_json::json!({
        "start_url": "https://example.com/",
        "pages_crawled": 0,
        "health_score": 100,
        "critical_count": 0,
        "warning_count": 0,
        "notice_count": 0,
        "pages": [],
        "duration_ms": 0,
        "cancelled": false,
        "timed_out": false,
        "robots_txt_status": "unavailable",
        "robots_blocked_count": 0,
        "sitemap_status": "unavailable",
        "sitemap_urls_discovered": 0,
        "sitemap_urls": [],
        "rejected_urls": [],
        "resources": [],
        "resource_limit_reached": false
    });

    let parsed: SiteCrawlResult = serde_json::from_value(legacy).unwrap();

    assert_eq!(parsed.crawl_mode, "http");
    assert!(!parsed.discovery_provenance_truncated);
    assert!(parsed.limit_reasons.is_empty());
}

#[test]
fn discovery_sources_are_deduplicated_and_bounded() {
    let mut sources_by_url = HashMap::new();
    let source = CrawledDiscoverySource {
        kind: "link".into(),
        source_url: Some("https://example.com/guide".into()),
        anchor_text: Some("Guide".into()),
    };

    assert!(record_discovery_source(
        &mut sources_by_url,
        "https://example.com/target",
        source.clone(),
    ));
    assert!(record_discovery_source(
        &mut sources_by_url,
        "https://example.com/target",
        source
    ));
    let mut dropped = false;
    for index in 0..(MAX_DISCOVERY_SOURCES_PER_PAGE + 4) {
        dropped |= !record_discovery_source(
            &mut sources_by_url,
            "https://example.com/target",
            CrawledDiscoverySource {
                kind: "link".into(),
                source_url: Some(format!("https://example.com/source-{index}")),
                anchor_text: None,
            },
        );
    }
    assert!(dropped, "the provenance cap must be observable by callers");

    let sources = sources_by_url
        .get("https://example.com/target")
        .expect("target provenance should be recorded");
    assert_eq!(sources.len(), MAX_DISCOVERY_SOURCES_PER_PAGE);
    assert_eq!(sources[0].anchor_text.as_deref(), Some("Guide"));
}
