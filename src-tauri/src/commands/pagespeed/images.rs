use super::metrics::short_text;
use serde_json::{json, Value};

const IMAGE_AUDIT_IDS: [&str; 5] = [
    "uses-optimized-images",
    "modern-image-formats",
    "uses-webp-images",
    "uses-responsive-images",
    "efficient-animated-content",
];

pub(super) fn map_image_optimization_audits(categories: &Value, audits: &Value) -> Vec<Value> {
    let Some(references) = categories
        .pointer("/performance/auditRefs")
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };

    references
        .iter()
        .filter_map(|reference| reference.get("id").and_then(Value::as_str))
        .filter(|id| IMAGE_AUDIT_IDS.contains(id))
        .filter_map(|id| {
            let audit = audits.get(id)?;
            let items = audit
                .pointer("/details/items")
                .or_else(|| audit.pointer("/details/nodes"))
                .and_then(Value::as_array);
            let evidence = items
                .into_iter()
                .flatten()
                .take(50)
                .map(|item| {
                    let node = item.get("node").unwrap_or(item);
                    json!({
                        "url": short_text(item.get("url").or_else(|| item.get("resource"))),
                        "label": short_text(node.get("nodeLabel").or_else(|| item.get("nodeLabel"))),
                        "selector": short_text(node.get("selector").or_else(|| item.get("selector"))),
                        "snippet": short_text(node.get("snippet").or_else(|| item.get("snippet"))),
                        "totalBytes": item.get("totalBytes").cloned().unwrap_or(Value::Null),
                        "wastedBytes": item.get("wastedBytes").cloned().unwrap_or(Value::Null),
                        "wastedPercent": item.get("wastedPercent").cloned().unwrap_or(Value::Null),
                        "displayValue": short_text(item.get("displayValue")),
                    })
                })
                .collect::<Vec<_>>();
            let evidence_count = items.map(Vec::len).unwrap_or_default();

            Some(json!({
                "id": id,
                "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
                "description": audit.get("description").and_then(Value::as_str).unwrap_or(""),
                "score": audit.get("score").and_then(Value::as_f64),
                "scoreDisplayMode": audit.get("scoreDisplayMode").and_then(Value::as_str),
                "displayValue": audit.get("displayValue").and_then(Value::as_str),
                "overallSavingsBytes": audit.pointer("/details/overallSavingsBytes").and_then(Value::as_f64),
                "evidence": evidence,
                "evidenceCount": evidence_count,
                "evidenceTruncated": evidence_count > 50,
            }))
        })
        .collect()
}
