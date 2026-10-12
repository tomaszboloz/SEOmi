use super::super::*;
use crate::commands::site_crawler::schema_references::push_schema_reference;

#[test]
fn near_duplicate_pairs_orders_descending_indexes_and_rejects_far_signatures() {
    let descending = vec![
        (5, "0000000000000000".to_string()),
        (2, "0000000000000001".into()),
    ];
    assert_eq!(near_duplicate_pairs(&descending), vec![(2, 5, 1)]);
    // Same lowest byte (one LSH bucket) but far apart in Hamming distance.
    let far = vec![
        (0, "0000000000000000".to_string()),
        (1, "ffffffffffffff00".into()),
    ];
    assert!(near_duplicate_pairs(&far).is_empty());
}

#[test]
fn favicon_with_blank_href_is_ignored() {
    let document =
        Html::parse_document(r#"<link rel="icon" href="  "><link rel="icon" href="/a.ico">"#);
    let base = url::Url::parse("https://example.com/").unwrap();
    let icons = crawl_favicon_metadata(&document, &base);
    assert_eq!(icons.len(), 1);
    assert_eq!(icons[0].href, "https://example.com/a.ico");
}

#[test]
fn empty_documents_still_report_missing_language_and_charset() {
    let document = Html::parse_document("");
    let (mut findings, mut truncated) = (Vec::new(), false);
    crate::commands::site_crawler::html_validation_rules::check_html_language(
        &document,
        "",
        "",
        &mut findings,
        &mut truncated,
    );
    crate::commands::site_crawler::html_validation_rules::check_html_meta_charset(
        &document,
        "",
        "",
        None,
        &mut findings,
        &mut truncated,
    );
    let codes = findings.iter().map(|f| f.code.as_str()).collect::<Vec<_>>();
    assert_eq!(codes, ["html-lang-missing", "html-meta-charset-missing"]);
    assert!(findings.iter().all(|f| f.line.is_none()));
}

#[test]
fn schema_references_stop_at_the_per_page_cap() {
    let mut references = Vec::new();
    for index in 0..70 {
        push_schema_reference(
            &mut references,
            "json-ld",
            index,
            "url",
            &format!("https://e.test/{index}"),
        );
    }
    assert_eq!(references.len(), MAX_SCHEMA_REFERENCES_PER_PAGE);
}

#[test]
fn stopwords_are_semantic_noise() {
    assert!(semantic_noise_token("the"));
    assert!(!semantic_noise_token("crawler"));
}

#[test]
fn discovery_targets_are_capped_per_run() {
    let source = |n: &str| CrawledDiscoverySource {
        kind: "link".into(),
        source_url: Some(n.into()),
        anchor_text: None,
    };
    let mut map = HashMap::new();
    for index in 0..MAX_DISCOVERY_TARGETS_PER_RUN {
        assert!(record_discovery_source(
            &mut map,
            &format!("u{index}"),
            source("a")
        ));
    }
    assert!(!record_discovery_source(&mut map, "overflow", source("a")));
    assert!(record_discovery_source(&mut map, "u0", source("a")));
}

#[test]
fn frame_resources_without_a_checked_match_stay_unchecked() {
    let mut page = post_processing_page("https://example.com/");
    let frame = |url: &str| CrawledFrame {
        src: None,
        resolved_url: Some(url.into()),
        title: None,
        name: None,
        loading: None,
        sandbox: None,
        checked_in_run: false,
        http_status: None,
        request_error_kind: None,
    };
    page.frames = vec![frame("https://example.com/missing")];
    apply_checked_frame_resources(
        std::slice::from_mut(&mut page),
        &[],
        &crawl_config_for_test(),
    );
    assert!(!page.frames[0].checked_in_run);
}
