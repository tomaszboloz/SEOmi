use super::*;
use std::collections::{HashMap, HashSet};
use url::Url;

#[derive(Default)]
pub(super) struct GraphNode {
    pub(super) page: usize,
    pub(super) id: Option<String>,
    pub(super) has_id: bool,
    pub(super) types: HashSet<String>,
    pub(super) names: HashSet<String>,
    pub(super) same_as: HashSet<String>,
    pub(super) has_url: bool,
}

impl GraphNode {
    pub(super) fn is_definition(&self) -> bool {
        !self.types.is_empty() || !self.names.is_empty() || !self.same_as.is_empty() || self.has_url
    }
}

pub(super) fn annotate_schema_graph(pages: &mut [CrawledPageSummary]) {
    let hosts = pages
        .iter()
        .filter(|page| graph_evidence_complete(page))
        .flat_map(|page| [page.url.as_str(), page.final_url.as_str()])
        .filter_map(|url| {
            Url::parse(url)
                .ok()?
                .host_str()
                .map(str::to_ascii_lowercase)
        })
        .collect::<HashSet<_>>();
    let crawled_bases = pages
        .iter()
        .filter(|page| graph_evidence_complete(page))
        .flat_map(|page| [page.url.as_str(), page.final_url.as_str()])
        .filter_map(page_identity)
        .collect::<HashSet<_>>();
    let mut nodes = Vec::new();
    let mut node_indexes = HashMap::new();
    for (page_index, page) in pages.iter().enumerate() {
        if !graph_evidence_complete(page) {
            continue;
        }
        for reference in page
            .schema_references
            .iter()
            .filter(|item| item.format == "JSON-LD")
        {
            let Some(path) = reference.node_path.as_deref() else {
                continue;
            };
            let key = (page_index, reference.declaration_index, path.to_string());
            let index = *node_indexes.entry(key).or_insert_with(|| {
                nodes.push(GraphNode {
                    page: page_index,
                    ..Default::default()
                });
                nodes.len() - 1
            });
            let node = &mut nodes[index];
            match reference.property.as_str() {
                "@id" => {
                    node.has_id = true;
                    node.id = local_identifier(page_base(page), &reference.value, &hosts)
                }
                "@type" => {
                    node.types.insert(entity_type(&reference.value));
                }
                "name" => {
                    node.names.insert(normalized(&reference.value));
                }
                "sameAs" => {
                    node.same_as.insert(normalized_same_as(&reference.value));
                }
                "url" => node.has_url = true,
                _ => {}
            }
        }
    }

    let defined_ids = nodes
        .iter()
        .filter(|node| node.is_definition())
        .filter_map(|node| node.id.as_ref())
        .cloned()
        .collect::<HashSet<_>>();
    let mut issues = HashMap::<usize, HashSet<String>>::new();
    for (page_index, page) in pages.iter().enumerate() {
        if !graph_evidence_complete(page) {
            continue;
        }
        for reference in page.schema_references.iter().filter(|item| {
            item.format == "JSON-LD" && GRAPH_RELATION_PROPERTIES.contains(&item.property.as_str())
        }) {
            let Some(target) = local_identifier(page_base(page), &reference.value, &hosts) else {
                continue;
            };
            let has_fragment = Url::parse(&target)
                .ok()
                .is_some_and(|url| url.fragment().is_some_and(|fragment| !fragment.is_empty()));
            if has_fragment
                && !defined_ids.contains(&target)
                && crawled_bases.contains(&page_identity(&target).unwrap_or_default())
            {
                add_issue(
                    &mut issues,
                    page_index,
                    format!(
                        "Structured data graph: {} references undeclared local @id {} in this crawl.",
                        reference.property, reference.value
                    ),
                );
            }
        }
    }

    collect_entity_issues(&nodes, &mut issues);
    let mut issues = issues.into_iter().collect::<Vec<_>>();
    issues.sort_by_key(|(page, _)| *page);
    for (page, messages) in issues {
        let mut messages = messages.into_iter().collect::<Vec<_>>();
        messages.sort();
        for message in messages {
            pages[page].issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message,
            });
        }
        pages[page].issues_count = pages[page].issues.len();
    }
}
