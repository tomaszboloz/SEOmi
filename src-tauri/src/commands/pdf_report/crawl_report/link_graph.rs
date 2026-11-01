//! The one orphan rule, ported from `src/services/linkGraph/orphans.ts` (#106). A page is an orphan when
//! it is not a root (crawl seed) and no other page links to it; self-links and empty endpoints never
//! count. `src/constants/linkGraphOrphanFixtures.json` pins both implementations to the same results.
use super::data::{flag, list, num};
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

/// Distinct linking nodes per target; self-links and empty endpoints are dropped.
pub fn inbound_sources<'a>(
    edges: impl IntoIterator<Item = (&'a str, &'a str)>,
) -> HashMap<&'a str, HashSet<&'a str>> {
    let mut inbound: HashMap<&str, HashSet<&str>> = HashMap::new();
    for (from, to) in edges {
        if from.is_empty() || to.is_empty() || from == to {
            continue;
        }
        inbound.entry(to).or_default().insert(from);
    }
    inbound
}

pub fn is_orphan(
    node: &str,
    inbound: &HashMap<&str, HashSet<&str>>,
    roots: &HashSet<&str>,
) -> bool {
    !roots.contains(node) && inbound.get(node).is_none_or(HashSet::is_empty)
}

/// Orphan nodes among `nodes`, sorted, under the single rule above.
pub fn orphan_nodes<'a>(
    nodes: &[&'a str],
    edges: impl IntoIterator<Item = (&'a str, &'a str)>,
    roots: &HashSet<&str>,
) -> Vec<&'a str> {
    let inbound = inbound_sources(edges);
    let mut found: Vec<&str> = nodes
        .iter()
        .copied()
        .filter(|node| is_orphan(node, &inbound, roots))
        .collect();
    found.sort_unstable();
    found
}

/// Pages no other crawled page links to (crawl seeds, depth 0, are never orphans). Same rule as the app
/// (`link_graph`): page indexes are the nodes, internal links resolve to a page by its URL or final URL.
pub fn orphans(pages: &[Value]) -> Vec<usize> {
    let mut by_url: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, page) in pages.iter().enumerate() {
        for url in [field(page, "url"), field(page, "final_url")]
            .into_iter()
            .flatten()
        {
            by_url.entry(url).or_default().push(index);
        }
    }
    let ids: Vec<String> = (0..pages.len()).map(|index| index.to_string()).collect();
    let edges: Vec<(&str, &str)> = pages
        .iter()
        .enumerate()
        .flat_map(|(from, page)| {
            list(page, "links")
                .iter()
                .filter(|link| flag(link, "is_internal"))
                .filter_map(|link| field(link, "target_url").and_then(|url| by_url.get(&url)))
                .flatten()
                .map(|&to| (from, to))
                .collect::<Vec<_>>()
        })
        .map(|(from, to)| (ids[from].as_str(), ids[to].as_str()))
        .collect();
    let roots: HashSet<&str> = (0..pages.len())
        .filter(|&i| num(&pages[i], "depth").unwrap_or(0.0) <= 0.0)
        .map(|i| ids[i].as_str())
        .collect();
    let nodes: Vec<&str> = ids.iter().map(String::as_str).collect();
    let mut found: Vec<usize> = orphan_nodes(&nodes, edges, &roots)
        .into_iter()
        .map(|id| id.parse().unwrap_or_default())
        .collect();
    found.sort_unstable();
    found
}
