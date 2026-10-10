//! Fold `page#fragment` rows into their document.
//!
//! Search Console reports a jump-to link as a page of its own. The link is
//! shown under the document's result, so its impressions repeat the
//! document's and would be counted twice if they were added up. A folded row
//! therefore keeps the largest impression count together with the position
//! of the row that had it, and adds up only the clicks.

use serde_json::{json, Value};
use std::collections::HashMap;

fn number(row: &Value, name: &str) -> f64 {
    row.get(name).and_then(Value::as_f64).unwrap_or(0.0)
}

fn document(page: &str) -> &str {
    page.split_once('#').map_or(page, |(document, _)| document)
}

/// Merge rows that differ only by the fragment of `page`. `group_by` names a
/// second key (the query of a query/page pair) that must also be equal.
pub(super) fn fold_fragment_rows(rows: Vec<Value>, group_by: Option<&str>) -> Vec<Value> {
    let mut folded: Vec<Value> = Vec::with_capacity(rows.len());
    let mut index: HashMap<(String, String), usize> = HashMap::new();
    for mut row in rows {
        let Some(page) = row.get("page").and_then(Value::as_str) else {
            folded.push(row);
            continue;
        };
        let page = document(page).to_string();
        let group = group_by
            .and_then(|key| row.get(key).and_then(Value::as_str))
            .unwrap_or_default()
            .to_string();
        row["page"] = Value::String(page.clone());
        let Some(&position) = index.get(&(group.clone(), page.clone())) else {
            index.insert((group, page), folded.len());
            folded.push(row);
            continue;
        };
        let kept = &mut folded[position];
        let clicks = number(kept, "clicks") + number(&row, "clicks");
        if number(&row, "impressions") > number(kept, "impressions") {
            kept["impressions"] = row["impressions"].clone();
            kept["position"] = row["position"].clone();
        }
        let impressions = number(kept, "impressions");
        kept["clicks"] = json!(clicks);
        kept["ctr"] = json!(if impressions > 0.0 {
            (clicks / impressions * 1000.0).round() / 10.0
        } else {
            0.0
        });
    }
    folded
}

#[cfg(test)]
#[path = "fragments_tests.rs"]
mod tests;
