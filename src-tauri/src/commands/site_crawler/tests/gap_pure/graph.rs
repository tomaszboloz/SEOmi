use super::super::*;
use crate::commands::site_crawler::schema_graph_analysis::GraphNode;

fn node(page: usize, id: Option<&str>, kind: &str, name: &str, same_as: &[&str]) -> GraphNode {
    GraphNode {
        page,
        id: id.map(str::to_string),
        has_id: id.is_some(),
        types: [kind.to_string()].into_iter().collect(),
        names: [name.to_string()].into_iter().collect(),
        same_as: same_as.iter().map(|v| v.to_string()).collect(),
        has_url: false,
    }
}

fn run(nodes: &[GraphNode]) -> HashMap<usize, HashSet<String>> {
    let mut issues = HashMap::new();
    collect_entity_issues(nodes, &mut issues);
    issues
}

#[test]
fn same_id_with_different_names_conflicts_even_when_types_match() {
    let issues = run(&[
        node(0, Some("#a"), "organization", "One", &[]),
        node(1, Some("#a"), "organization", "Two", &[]),
    ]);
    assert!(issues[&0].iter().any(|m| m.contains("conflicting")));
}

#[test]
fn same_id_with_different_same_as_is_inconsistent() {
    let issues = run(&[
        node(0, Some("#a"), "person", "A", &["https://x.test/1"]),
        node(1, Some("#a"), "person", "A", &["https://x.test/2"]),
    ]);
    assert!(issues[&1].iter().any(|m| m.contains("sameAs")));
}

#[test]
fn repeated_entity_on_one_page_is_not_flagged_but_across_pages_is() {
    let same_page = run(&[
        node(0, None, "organization", "Acme", &[]),
        node(0, None, "organization", "Acme", &[]),
    ]);
    assert!(same_page.is_empty());
    let across = run(&[
        node(0, None, "organization", "Acme", &[]),
        node(1, None, "organization", "Acme", &[]),
    ]);
    assert_eq!(across.len(), 2);
}

fn reference(property: &str, value: &str) -> CrawledSchemaReference {
    CrawledSchemaReference {
        format: "JSON-LD".into(),
        declaration_index: 0,
        property: property.into(),
        value: value.into(),
        node_path: Some("0".into()),
    }
}

#[test]
fn a_url_property_makes_an_identified_node_a_definition() {
    let issues = |with_url: bool| {
        let mut page = common_fixture::post_processing_page("https://example.test/");
        page.schema_references = vec![reference("@id", "https://example.test/#org")];
        if with_url {
            page.schema_references
                .push(reference("url", "https://example.test/"));
        }
        page.schema_references
            .push(reference("publisher", "https://example.test/#org"));
        let mut pages = vec![page];
        annotate_schema_graph(&mut pages);
        pages[0].issues.len()
    };
    assert_eq!(issues(true), 0);
    assert_eq!(issues(false), 1);
}
