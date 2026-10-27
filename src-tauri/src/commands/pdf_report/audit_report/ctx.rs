use super::model::Finding;
use serde_json::Value;

static NO_ITEMS: Vec<Value> = Vec::new();

/// Read-only view of the audit JSON plus the findings derived from it.
pub struct Ctx<'a> {
    pub audit: &'a Value,
    pub findings: Vec<Finding>,
}

pub fn text_at(audit: &Value, pointer: &str) -> Option<String> {
    let value = audit.pointer(pointer)?.as_str()?.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

pub fn list_at<'a>(audit: &'a Value, pointer: &str) -> &'a [Value] {
    audit
        .pointer(pointer)
        .and_then(Value::as_array)
        .unwrap_or(&NO_ITEMS)
}

/// Text of a JSON value, without quotes, for display in tables.
pub fn field(value: &Value, key: &str) -> Option<String> {
    match value.get(key)? {
        Value::String(text) if !text.trim().is_empty() => Some(text.trim().to_owned()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}

impl<'a> Ctx<'a> {
    pub fn text(&self, pointer: &str) -> Option<String> {
        text_at(self.audit, pointer)
    }

    pub fn number(&self, pointer: &str) -> Option<f64> {
        self.audit.pointer(pointer)?.as_f64()
    }

    pub fn flag(&self, pointer: &str) -> Option<bool> {
        self.audit.pointer(pointer)?.as_bool()
    }

    pub fn list(&self, pointer: &str) -> &'a [Value] {
        list_at(self.audit, pointer)
    }

    /// Number rendered without a trailing `.0`, or `None` when absent.
    pub fn count(&self, pointer: &str) -> Option<String> {
        self.number(pointer).map(format_number)
    }

    /// First finding whose code starts with one of the prefixes.
    pub fn issue(&self, prefixes: &[&str]) -> Option<&Finding> {
        self.findings.iter().find(|finding| {
            prefixes
                .iter()
                .any(|prefix| finding.code.starts_with(prefix))
        })
    }
}

/// `2026-10-13T17:30:39.2Z` becomes `2026-10-13 17:30 UTC`; other text is kept.
pub fn pretty_time(raw: &str) -> String {
    match (raw.get(..16), raw.get(10..11), raw.ends_with('Z')) {
        (Some(head), Some("T"), true) => format!("{} UTC", head.replacen('T', " ", 1)),
        _ => raw.to_owned(),
    }
}

pub fn format_number(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{value:.0}")
    } else {
        format!("{value:.1}")
    }
}
