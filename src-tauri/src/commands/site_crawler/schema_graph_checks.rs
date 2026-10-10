use super::schema_graph_analysis::GraphNode;
use super::schema_graph_analysis_helpers::add_issue;
use std::collections::{HashMap, HashSet};

pub(super) fn collect_entity_issues(
    nodes: &[GraphNode],
    issues: &mut HashMap<usize, HashSet<String>>,
) {
    let mut by_id = HashMap::<String, Vec<&GraphNode>>::new();
    for node in nodes.iter().filter(|node| node.is_definition()) {
        if let Some(id) = &node.id {
            by_id.entry(id.clone()).or_default().push(node);
        }
    }
    for (id, group) in by_id {
        let type_sets = group
            .iter()
            .filter_map(|node| {
                let types = node
                    .types
                    .iter()
                    .filter(|kind| !["thing", "intangible"].contains(&kind.as_str()))
                    .cloned()
                    .collect::<HashSet<_>>();
                (!types.is_empty()).then_some(types)
            })
            .collect::<Vec<_>>();
        let names = group
            .iter()
            .flat_map(|node| node.names.iter().cloned())
            .collect::<HashSet<_>>();
        let types_compatible = type_sets
            .first()
            .map(|first| {
                type_sets
                    .iter()
                    .skip(1)
                    .fold(first.clone(), |common, types| {
                        common.intersection(types).cloned().collect()
                    })
            })
            .is_some_and(|common: HashSet<String>| !common.is_empty());
        if (!types_compatible && type_sets.len() > 1) || names.len() > 1 {
            for node in &group {
                add_issue(issues, node.page, format!(
                    "Structured data graph: local @id {id} has conflicting @type or name declarations in this crawl."
                ));
            }
        }
        let same_as_sets = group
            .iter()
            .map(|node| {
                let mut values = node.same_as.iter().cloned().collect::<Vec<_>>();
                values.sort();
                values.join("\u{1f}")
            })
            .collect::<HashSet<_>>();
        if group.len() > 1 && same_as_sets.len() > 1 {
            for node in &group {
                add_issue(issues, node.page, format!(
                    "Structured data graph: local @id {id} has inconsistent sameAs declarations in this crawl."
                ));
            }
        }
    }

    let mut repeated = HashMap::<(String, String), Vec<&GraphNode>>::new();
    for node in nodes
        .iter()
        .filter(|node| node.id.is_none() && !node.has_id)
    {
        for kind in ["organization", "person", "website"] {
            if node.types.contains(kind) {
                for name in &node.names {
                    repeated
                        .entry((kind.into(), name.clone()))
                        .or_default()
                        .push(node);
                }
            }
        }
    }
    for ((kind, name), group) in repeated {
        if group
            .iter()
            .map(|node| node.page)
            .collect::<HashSet<_>>()
            .len()
            > 1
        {
            for node in group {
                add_issue(issues, node.page, format!(
                    "Structured data graph: {kind} `{name}` appears on multiple crawled pages without a shared @id."
                ));
            }
        }
    }
}
