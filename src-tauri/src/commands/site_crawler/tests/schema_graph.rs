use super::*;
use common_fixture::post_processing_page;
use scraper::Html;

fn page_with_jsonld(url: &str, jsonld: &str) -> CrawledPageSummary {
    let mut page = post_processing_page(url);
    let document = Html::parse_document(&format!(
        "<script type=\"application/ld+json\">{jsonld}</script>"
    ));
    let (types, syntax_errors, findings, references, truncated) = inspect_page_schema(&document);
    page.schema_types = types;
    page.schema_syntax_errors = syntax_errors;
    page.schema_validation_findings = findings;
    page.schema_references = references;
    page.schema_validation_truncated = truncated;
    page
}

#[test]
fn graph_flags_observed_local_dangling_ids_but_skips_external_or_uncrawled_targets() {
    let page = page_with_jsonld(
        "https://example.test/article",
        r##"{"@context":"https://schema.org","@type":"Article","author":{"@id":"#missing"},"publisher":{"@id":"https://remote.test/#org"},"about":"https://example.test/missing#entity"}"##,
    );
    assert!(page
        .schema_references
        .iter()
        .any(|item| { item.property == "author" && item.node_path.as_deref() == Some("$") }));
    assert!(page
        .schema_references
        .iter()
        .any(|item| { item.property == "@id" && item.node_path.as_deref() == Some("$.author") }));

    let mut partial = page_with_jsonld(
        "https://example.test/partial",
        r##"{"@context":"https://schema.org","@type":"Article","author":"#missing"}"##,
    );
    partial.schema_validation_truncated = true;
    let mut pages = vec![page, partial];
    annotate_page_relations(&mut pages, "http");
    assert!(pages[0].issues.iter().any(|issue| issue
        .message
        .contains("author references undeclared local @id")));
    assert!(!pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("publisher") || issue.message.contains("about")));
    assert!(pages[1].issues.is_empty());
}

#[test]
fn graph_resolves_relative_ids_against_final_url_and_reports_conflicts() {
    let mut source = page_with_jsonld(
        "https://example.test/old",
        r##"{"@context":"https://schema.org","@type":"Article","author":"#author"}"##,
    );
    source.final_url = "https://example.test/new".into();
    let target = page_with_jsonld(
        "https://example.test/new",
        r##"{"@context":"https://schema.org","@id":"#author","@type":"Person","name":"Author"}"##,
    );
    let mut pages = vec![source, target];
    annotate_page_relations(&mut pages, "http");
    assert!(!pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("undeclared local @id")));

    let first = page_with_jsonld(
        "https://example.test/one",
        r#"{"@context":"https://schema.org","@id":"https://example.test/#org","@type":"Organization","name":"Acme","sameAs":"https://social.test/acme"}"#,
    );
    let second = page_with_jsonld(
        "https://example.test/two",
        r#"{"@context":"https://schema.org","@id":"https://example.test/#org","@type":"Person","name":"Other","sameAs":"https://social.test/other"}"#,
    );
    let mut pages = vec![first, second];
    annotate_page_relations(&mut pages, "http");
    for page in pages {
        assert!(page
            .issues
            .iter()
            .any(|issue| issue.message.contains("conflicting")));
        assert!(page
            .issues
            .iter()
            .any(|issue| issue.message.contains("inconsistent sameAs")));
    }
}

#[test]
fn graph_reports_repeated_named_entities_without_ids_but_ignores_remote_ids() {
    let mut pages = Vec::new();
    for (kind, name) in [
        ("Organization", "Acme"),
        ("Person", "Author"),
        ("WebSite", "Acme"),
    ] {
        pages.push(page_with_jsonld(
            &format!("https://example.test/{kind}-one"),
            &format!(r#"{{"@context":"https://schema.org","@type":"{kind}","name":"{name}"}}"#),
        ));
        pages.push(page_with_jsonld(
            &format!("https://example.test/{kind}-two"),
            &format!(r#"{{"@context":"https://schema.org","@type":"{kind}","name":"{name}"}}"#),
        ));
    }
    pages.push(page_with_jsonld(
        "https://example.test/remote",
        r#"{"@context":"https://schema.org","@id":"https://remote.test/#org","@type":"Organization","name":"Remote"}"#,
    ));
    pages.push(page_with_jsonld(
        "https://example.test/remote-two",
        r#"{"@context":"https://schema.org","@id":"https://remote.test/#org","@type":"Organization","name":"Remote"}"#,
    ));
    annotate_page_relations(&mut pages, "http");
    for page in pages.iter().take(6) {
        assert!(page
            .issues
            .iter()
            .any(|issue| issue.message.contains("without a shared @id")));
    }
    assert!(pages[6].issues.is_empty() && pages[7].issues.is_empty());
}
