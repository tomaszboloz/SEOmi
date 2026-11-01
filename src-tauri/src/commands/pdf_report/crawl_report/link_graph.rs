//! The one orphan rule, ported from `src/services/linkGraph/orphans.ts` (#106). A page is an orphan when
//! it is not a root (crawl seed) and no other page links to it; self-links and empty endpoints never
//! count. `src/constants/linkGraphOrphanFixtures.json` pins both implementations to the same results.
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
