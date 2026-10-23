use super::*;
use common_fixture::post_processing_page;
use scraper::Html;

fn page(url: &str, jsonld: &str) -> CrawledPageSummary {
    let mut page = post_processing_page(url);
    let document = Html::parse_document(&format!(
        "<script type=\"application/ld+json\">{jsonld}</script>"
    ));
    let (types, syntax, findings, references, truncated) = inspect_page_schema(&document);
    page.schema_types = types;
    page.schema_syntax_errors = syntax;
    page.schema_validation_findings = findings;
    page.schema_references = references;
    page.schema_validation_truncated = truncated;
    page
}

fn org(url: &str, same_as: &str) -> CrawledPageSummary {
    page(url, &format!(
        r#"{{"@context":"https://schema.org","@id":"https://example.test/#org","@type":"Organization","name":"Acme"{same_as}}}"#
    ))
}

fn inconsistent(pages: &[CrawledPageSummary]) -> bool {
    pages.iter().any(|p| p.issues.iter().any(|i| i.message.contains("inconsistent sameAs")))
}

#[test]
fn missing_or_empty_same_as_is_not_a_conflict() {
    for second in ["", r#","sameAs":[]"#] {
        let mut pages = vec![org("https://example.test/a", r#","sameAs":"https://social.test/acme""#), org("https://example.test/b", second)];
        annotate_page_relations(&mut pages, "http");
        assert!(!inconsistent(&pages));
    }
}

#[test]
fn same_list_in_other_order_is_not_a_conflict() {
    let mut pages = vec![
        org("https://example.test/a", r#","sameAs":["https://a.test","https://b.test"]"#),
        org("https://example.test/b", r#","sameAs":["https://b.test","https://a.test"]"#),
    ];
    annotate_page_relations(&mut pages, "http");
    assert!(!inconsistent(&pages));
}

#[test]
fn two_different_non_empty_sets_still_conflict() {
    let mut pages = vec![
        org("https://example.test/a", r#","sameAs":"https://a.test""#),
        org("https://example.test/b", r#","sameAs":"https://b.test""#),
    ];
    annotate_page_relations(&mut pages, "http");
    assert!(inconsistent(&pages));
}
