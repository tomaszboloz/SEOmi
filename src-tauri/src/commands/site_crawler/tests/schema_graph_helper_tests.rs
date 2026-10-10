use super::*;
use common_fixture::post_processing_page;
use std::collections::HashSet;

#[test]
fn schema_helpers_cover_boundaries_and_normalization() {
    assert_eq!(
        schema_graph_analysis_helpers::normalized_same_as("   not a url   "),
        "not a url"
    );

    let mut page = post_processing_page("https://example.test/orig");
    page.final_url = "not-a-valid-url".into();
    assert_eq!(
        schema_graph_analysis_helpers::page_base(&page),
        "https://example.test/orig"
    );
    page.final_url = "ftp://example.test/file".into();
    assert_eq!(
        schema_graph_analysis_helpers::page_base(&page),
        "https://example.test/orig"
    );

    let mut hosts = HashSet::new();
    hosts.insert("example.test".into());
    assert!(schema_graph_analysis_helpers::local_identifier(
        "https://example.test/",
        "mailto:test@example.test",
        &hosts
    )
    .is_none());
    assert!(schema_graph_analysis_helpers::local_identifier(
        "https://example.test/",
        "https://other.test/page#frag",
        &hosts
    )
    .is_none());

    page.http_status = 0;
    page.semantic_content_provenance = "rendered".into();
    page.semantic_content_source = "dom".into();
    assert!(schema_graph_analysis_helpers::graph_evidence_complete(
        &page
    ));

    page.semantic_content_source = "unavailable".into();
    assert!(!schema_graph_analysis_helpers::graph_evidence_complete(
        &page
    ));

    page.semantic_content_provenance = "raw".into();
    assert!(!schema_graph_analysis_helpers::graph_evidence_complete(
        &page
    ));
}

#[test]
fn schema_graph_values_covers_arrays_duplicates_and_controls() {
    let mut map = serde_json::Map::new();
    map.insert(
        "@type".into(),
        serde_json::json!(["Article", "NewsArticle"]),
    );
    let mut refs = Vec::new();
    schema_graph_values::push_node_values(&map, "@type", 0, &mut refs, "0");
    assert_eq!(refs.len(), 2);

    schema_graph_values::push_node_values(&map, "@type", 0, &mut refs, "0");
    assert_eq!(refs.len(), 2);

    let relation_val = serde_json::json!([
        123,
        "author-1",
        { "@id": "author-2" },
        { "name": "no-id" }
    ]);
    schema_graph_values::push_relation_values("author", &relation_val, 0, &mut refs, "0");
    assert_eq!(
        refs.iter()
            .map(|reference| reference.value.as_str())
            .collect::<Vec<_>>(),
        vec!["Article", "NewsArticle", "author-1", "author-2"]
    );
    assert!(refs
        .iter()
        .all(|reference| reference.node_path.as_deref() == Some("0")));

    let mut bad_map = serde_json::Map::new();
    bad_map.insert("bad".into(), serde_json::json!("val\x00ctrl"));
    bad_map.insert("empty".into(), serde_json::json!(""));
    bad_map.insert("long".into(), serde_json::json!("x".repeat(2049)));
    bad_map.insert("".into(), serde_json::json!("valid"));
    schema_graph_values::push_node_values(&bad_map, "bad", 0, &mut refs, "0");
    schema_graph_values::push_node_values(&bad_map, "empty", 0, &mut refs, "0");
    schema_graph_values::push_node_values(&bad_map, "long", 0, &mut refs, "0");
    schema_graph_values::push_node_values(&bad_map, "", 0, &mut refs, "0");
    assert_eq!(refs.len(), 4);
}
