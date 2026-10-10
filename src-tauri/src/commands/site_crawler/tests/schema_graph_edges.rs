use super::*;
use common_fixture::post_processing_page;
use scraper::Html;

fn jsonld_page(url: &str, value: &str) -> CrawledPageSummary {
    let mut page = post_processing_page(url);
    let document = Html::parse_document(&format!(
        "<script type=\"application/ld+json\">{value}</script>"
    ));
    let (types, syntax, findings, references, truncated) = inspect_page_schema(&document);
    page.schema_types = types;
    page.schema_syntax_errors = syntax;
    page.schema_validation_findings = findings;
    page.schema_references = references;
    page.schema_validation_truncated = truncated;
    page
}

fn reference(
    format: &str,
    declaration_index: usize,
    property: &str,
    value: &str,
    node_path: Option<&str>,
) -> CrawledSchemaReference {
    CrawledSchemaReference {
        format: format.into(),
        declaration_index,
        property: property.into(),
        value: value.into(),
        node_path: node_path.map(str::to_owned),
    }
}

#[test]
fn pointer_only_nodes_do_not_satisfy_dangling_entity_references() {
    let mut page = jsonld_page(
        "https://example.test/article",
        r##"{"@context":"https://schema.org","@graph":[{"@type":"Article","author":{"@id":"#person"}},{"@id":"#person"}]}"##,
    );
    annotate_page_relations(std::slice::from_mut(&mut page), "http");
    assert!(page.issues.iter().any(|issue| issue
        .message
        .contains("author references undeclared local @id")));
}

#[test]
fn failed_or_truncated_pages_do_not_contribute_graph_definitions() {
    let first = jsonld_page(
        "https://example.test/one",
        r##"{"@context":"https://schema.org","@id":"#org","@type":"Organization","name":"Acme"}"##,
    );
    let mut failed = jsonld_page(
        "https://example.test/two",
        r##"{"@context":"https://schema.org","@id":"#org","@type":"Person","name":"Other"}"##,
    );
    failed.http_status = 302;
    failed.redirect_stop_reason = Some("redirect stopped".into());
    let mut truncated = jsonld_page(
        "https://example.test/three",
        r##"{"@context":"https://schema.org","@id":"#org","@type":"Person","name":"Third"}"##,
    );
    truncated.body_truncated = true;
    let mut pages = vec![first, failed, truncated];
    annotate_page_relations(&mut pages, "http");
    assert!(pages.iter().all(|page| page.issues.is_empty()));
}

#[test]
fn empty_fragment_is_not_reported_as_a_missing_entity_identifier() {
    let source = jsonld_page(
        "https://example.test/source",
        r##"{"@context":"https://schema.org","@type":"Article","author":"https://example.test/target#"}"##,
    );
    let target = post_processing_page("https://example.test/target");
    let mut pages = vec![source, target];
    annotate_page_relations(&mut pages, "http");
    assert!(!pages[0]
        .issues
        .iter()
        .any(|issue| issue.message.contains("undeclared local @id")));
}

#[test]
fn unicode_name_normalization_and_messages_are_deterministic() {
    let mut pages = vec![
        jsonld_page(
            "https://example.test/a",
            r##"{"@context":"https://schema.org","@id":"#org","@type":"Organization","name":"Żółć"}"##,
        ),
        jsonld_page(
            "https://example.test/b",
            r##"{"@context":"https://schema.org","@id":"#org","@type":"Organization","name":"żółć"}"##,
        ),
    ];
    annotate_page_relations(&mut pages, "http");
    assert!(pages.iter().all(|page| page.issues.is_empty()));

    pages.push(jsonld_page(
        "https://example.test/c",
        r##"{"@context":"https://schema.org","@id":"#org","@type":"Person","name":"Other"}"##,
    ));
    let mut repeat = pages.clone();
    annotate_page_relations(&mut pages, "http");
    annotate_page_relations(&mut repeat, "http");
    let first = pages
        .iter()
        .flat_map(|page| page.issues.iter().map(|issue| issue.message.clone()))
        .collect::<Vec<_>>();
    let second = repeat
        .iter()
        .flat_map(|page| page.issues.iter().map(|issue| issue.message.clone()))
        .collect::<Vec<_>>();
    assert_eq!(first, second);
    assert!(first.iter().all(|message| message.contains("conflicting")));
}

#[test]
fn definitions_without_types_resolve_and_truncated_records_are_ignored() {
    let mut page = post_processing_page("https://example.test/def-only-name");
    page.schema_references = vec![
        reference("JSON-LD", 0, "name", "Only Name", Some("$")),
        reference(
            "JSON-LD",
            1,
            "sameAs",
            "https://social.test/item",
            Some("$.same"),
        ),
        reference("JSON-LD", 2, "author", "#entity", Some("$")),
        reference("JSON-LD", 2, "@id", "#entity", Some("$.entity")),
        reference(
            "JSON-LD",
            2,
            "name",
            "Entity without a type",
            Some("$.entity"),
        ),
        reference("Microdata", 3, "author", "Ignored", None),
    ];
    let mut truncated = post_processing_page("https://example.test/truncated");
    truncated.schema_validation_truncated = true;
    let mut pages = vec![page, truncated];
    annotate_page_relations(&mut pages, "http");
    assert!(pages[0]
        .schema_references
        .iter()
        .any(|reference| reference.value == "#entity"));
    assert!(pages.iter().all(|page| page.issues.is_empty()));
}
