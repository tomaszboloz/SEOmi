use super::metrics::short_text;
use serde_json::{json, Value};

fn map_touch_target_evidence(item: &Value) -> Value {
    let node = item.get("node").unwrap_or(item);
    json!({
        "label": short_text(node.get("nodeLabel").or_else(|| item.get("nodeLabel"))),
        "selector": short_text(node.get("selector").or_else(|| item.get("selector"))),
        "snippet": short_text(node.get("snippet").or_else(|| item.get("snippet"))),
        "target": short_text(item.get("target")),
        "targetSize": item.get("targetSize").cloned().unwrap_or(Value::Null),
        "boundingRect": item.get("boundingRect").cloned().unwrap_or(Value::Null),
        "failureSummary": short_text(item.get("failureSummary")),
        "explanation": short_text(item.get("explanation")),
    })
}

pub(super) fn map_touch_target_audit(categories: &Value, audits: &Value) -> Value {
    let Some(references) = categories
        .pointer("/accessibility/auditRefs")
        .and_then(Value::as_array)
    else {
        return Value::Null;
    };

    let candidate_ids = references
        .iter()
        .filter_map(|reference| reference.get("id").and_then(Value::as_str))
        .filter(|id| {
            let id = id.to_ascii_lowercase();
            id.contains("tap") || id.contains("target-size") || id.contains("target_size")
        })
        .collect::<Vec<_>>();

    let selected = ["target-size", "tap-targets", "tap-target-size"]
        .iter()
        .find_map(|id| candidate_ids.contains(id).then_some(*id))
        .or_else(|| candidate_ids.first().copied());
    let Some(id) = selected else {
        return Value::Null;
    };
    let Some(audit) = audits.get(id) else {
        return Value::Null;
    };
    let evidence = audit
        .pointer("/details/items")
        .or_else(|| audit.pointer("/details/nodes"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .take(50)
                .map(map_touch_target_evidence)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let total_evidence_count = audit
        .pointer("/details/items")
        .or_else(|| audit.pointer("/details/nodes"))
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or_default();

    json!({
        "id": id,
        "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
        "description": audit.get("description").and_then(Value::as_str).unwrap_or(""),
        "score": audit.get("score").and_then(Value::as_f64),
        "scoreDisplayMode": audit.get("scoreDisplayMode").and_then(Value::as_str),
        "displayValue": audit.get("displayValue").and_then(Value::as_str),
        "evidence": evidence,
        "evidenceCount": total_evidence_count,
        "evidenceTruncated": total_evidence_count > 50,
    })
}
