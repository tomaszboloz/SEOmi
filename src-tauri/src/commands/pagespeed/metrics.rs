use serde_json::{json, Value};

pub(super) fn audit_metric(audits: &Value, id: &str) -> Value {
    let Some(audit) = audits.get(id) else {
        return Value::Null;
    };
    json!({
        "id": id,
        "title": audit.get("title").and_then(Value::as_str).unwrap_or(id),
        "displayValue": audit.get("displayValue").and_then(Value::as_str),
        "numericValue": audit.get("numericValue").and_then(Value::as_f64),
        "score": audit.get("score").and_then(Value::as_f64),
    })
}

pub(super) fn short_text(value: Option<&Value>) -> Value {
    value
        .and_then(Value::as_str)
        .map(|text| {
            let shortened = text.chars().take(500).collect::<String>();
            Value::String(shortened)
        })
        .unwrap_or(Value::Null)
}
