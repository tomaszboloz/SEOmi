use super::data::{flag, list, num};
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Idx {
    Yes,
    No,
    Maybe,
}

/// Indexability class from the verdict, falling back to the status text.
pub fn indexability(page: &Value) -> Idx {
    let verdict = page
        .pointer("/indexability_verdict/status")
        .and_then(Value::as_str);
    let status = field(page, "indexability_status")
        .unwrap_or_default()
        .to_lowercase();
    match verdict {
        Some("indexable") => Idx::Yes,
        Some("blocked") => Idx::No,
        Some(_) => Idx::Maybe,
        None if status.starts_with("eligible") => Idx::Yes,
        None if status.contains("blocked") || status.starts_with("not ") => Idx::No,
        None => Idx::Maybe,
    }
}

/// First digit of the HTTP status (2 to 5); 0 when absent or unusual.
pub fn status_class(page: &Value) -> u8 {
    match num(page, "http_status") {
        Some(code) if (200.0..600.0).contains(&code) => (code / 100.0) as u8,
        _ => 0,
    }
}

/// Link whose target answered with an error or could not be requested.
pub fn is_broken(link: &Value) -> bool {
    num(link, "target_http_status").is_some_and(|code| code >= 400.0)
        || field(link, "target_request_error_kind").is_some()
}

/// Groups of page indexes sharing the same non-empty value, size 2 or more.
pub fn duplicate_groups(pages: &[Value], key: &str) -> Vec<(String, Vec<usize>)> {
    let mut groups: BTreeMap<String, Vec<usize>> = BTreeMap::new();
    for (index, page) in pages.iter().enumerate() {
        if let Some(value) = field(page, key) {
            groups.entry(value).or_default().push(index);
        }
    }
    groups
        .into_iter()
        .filter(|(_, group)| group.len() > 1)
        .collect()
}

pub use super::link_graph::orphans;

pub struct Metrics {
    pub counts: [usize; 3],
    pub classes: [usize; 5],
    pub avg_ms: Option<f64>,
    pub avg_words: Option<f64>,
    pub orphans: usize,
    pub dup_groups: usize,
    pub chains: usize,
    pub broken: [usize; 2],
    pub missing: [usize; 4],
    pub with_issues: usize,
}

fn average(pages: &[Value], key: &str) -> Option<f64> {
    let values: Vec<f64> = pages.iter().filter_map(|p| num(p, key)).collect();
    (!values.is_empty()).then(|| values.iter().sum::<f64>() / values.len() as f64)
}

pub fn compute(pages: &[Value]) -> Metrics {
    let count = |keep: &dyn Fn(&Value) -> bool| pages.iter().filter(|p| keep(p)).count();
    let broken = |internal: bool| {
        pages
            .iter()
            .flat_map(|p| list(p, "links"))
            .filter(|l| flag(l, "is_internal") == internal && is_broken(l))
            .count()
    };
    let mut classes = [0; 5];
    for page in pages {
        let class = status_class(page);
        classes[if (2..=5).contains(&class) {
            usize::from(class) - 2
        } else {
            4
        }] += 1;
    }
    Metrics {
        counts: [Idx::Yes, Idx::No, Idx::Maybe].map(|want| count(&|p| indexability(p) == want)),
        classes,
        avg_ms: average(pages, "response_time_ms"),
        avg_words: average(pages, "word_count"),
        orphans: orphans(pages).len(),
        dup_groups: ["title", "meta_description", "content_hash"]
            .iter()
            .map(|key| duplicate_groups(pages, key).len())
            .sum(),
        chains: count(&|p| list(p, "redirect_chain").len() >= 2),
        broken: [broken(true), broken(false)],
        missing: [
            count(&|p| field(p, "title").is_none()),
            count(&|p| field(p, "meta_description").is_none()),
            count(&|p| num(p, "h1_count") == Some(0.0)),
            count(&|p| field(p, "canonical_relation").as_deref() == Some("missing")),
        ],
        with_issues: count(&|p| !list(p, "issues").is_empty()),
    }
}
