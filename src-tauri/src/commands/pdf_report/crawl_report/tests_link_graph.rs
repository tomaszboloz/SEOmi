use super::link_graph::{inbound_sources, is_orphan, orphan_nodes};
use super::metrics::orphans;
use serde_json::{json, Value};
use std::collections::HashSet;

fn fixtures() -> Vec<Value> {
    serde_json::from_str(include_str!(
        "../../../../../src/constants/linkGraphOrphanFixtures.json"
    ))
    .expect("orphan fixtures are valid JSON")
}

fn texts(value: &Value) -> Vec<&str> {
    value
        .as_array()
        .expect("array")
        .iter()
        .map(|item| item.as_str().expect("text"))
        .collect()
}

#[test]
fn orphan_rule_matches_the_shared_cross_runtime_fixtures() {
    for fixture in fixtures() {
        let nodes = texts(&fixture["nodes"]);
        let roots: HashSet<&str> = texts(&fixture["roots"]).into_iter().collect();
        let edges: Vec<(&str, &str)> = fixture["edges"]
            .as_array()
            .expect("edges")
            .iter()
            .map(|pair| (pair[0].as_str().unwrap(), pair[1].as_str().unwrap()))
            .collect();
        assert_eq!(
            orphan_nodes(&nodes, edges, &roots),
            texts(&fixture["orphans"]),
            "{}",
            fixture["name"]
        );
    }
}

#[test]
fn single_checks_use_the_same_inbound_view() {
    let inbound = inbound_sources([("a", "b"), ("b", "b")]);
    let roots: HashSet<&str> = HashSet::from(["a"]);
    assert!(!is_orphan("b", &inbound, &roots));
    assert!(!is_orphan("a", &inbound, &roots));
    assert!(is_orphan("c", &inbound, &roots));
}

#[test]
fn crawl_report_orphans_use_the_shared_rule_on_url_and_final_url_links() {
    let pages = vec![
        json!({"url": "https://s/", "depth": 0, "links": [
            {"target_url": "https://s/moved", "is_internal": true},
            {"target_url": "https://s/ext", "is_internal": false},
            {"target_url": "https://s/", "is_internal": true}]}),
        json!({"url": "https://s/moved", "final_url": "https://s/new", "depth": 1, "links": []}),
        json!({"url": "https://s/lonely", "depth": 1, "links": [
            {"target_url": "https://s/lonely", "is_internal": true}]}),
        json!({"url": "https://s/ext", "depth": 1, "links": []}),
    ];
    assert_eq!(orphans(&pages), vec![2, 3]);
    assert!(orphans(&[]).is_empty());
}
