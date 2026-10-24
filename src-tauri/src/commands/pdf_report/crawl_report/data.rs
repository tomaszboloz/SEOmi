use crate::commands::pdf_report::audit_report::ctx::{field, list_at};
use serde_json::Value;

static NULL: Value = Value::Null;

pub struct OffPage<'a> {
    pub summary: &'a Value,
    pub tbva: &'a Value,
    pub sources: &'a [Value],
    pub co_citations: &'a [Value],
}

impl<'a> OffPage<'a> {
    pub fn new(summary: &'a Value) -> Self {
        Self {
            summary,
            tbva: summary.get("tbva").unwrap_or(&NULL),
            sources: list(summary, "sources"),
            co_citations: list(summary, "co_citations"),
        }
    }
}

/// Read-only view of a saved crawl run: the run envelope, its result and pages.
pub struct Crawl<'a> {
    pub run: &'a Value,
    pub result: &'a Value,
    pub pages: &'a [Value],
}

impl<'a> Crawl<'a> {
    pub fn new(run: &'a Value) -> Self {
        let result = run.get("result").unwrap_or(&NULL);
        Self {
            run,
            result,
            pages: list_at(result, "/pages"),
        }
    }

    /// Text or number of a result field.
    pub fn r(&self, key: &str) -> Option<String> {
        field(self.result, key)
    }

    pub fn rnum(&self, key: &str) -> Option<f64> {
        self.result.get(key)?.as_f64()
    }

    pub fn rflag(&self, key: &str) -> bool {
        self.result.get(key).and_then(Value::as_bool) == Some(true)
    }

    pub fn rlist(&self, key: &str) -> &'a [Value] {
        list_at(self.result, &format!("/{key}"))
    }
}

pub fn flag(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_bool) == Some(true)
}

pub fn num(value: &Value, key: &str) -> Option<f64> {
    value.get(key)?.as_f64()
}

pub fn list<'a>(value: &'a Value, key: &str) -> &'a [Value] {
    list_at(value, &format!("/{key}"))
}

/// Final URL of a page, falling back to the requested one.
pub fn page_url(page: &Value) -> String {
    field(page, "final_url")
        .or_else(|| field(page, "url"))
        .unwrap_or_default()
}

/// Joined list of strings, or `None` when the list is empty.
pub fn joined(value: &Value, key: &str, separator: &str) -> Option<String> {
    let items: Vec<String> = list(value, key)
        .iter()
        .filter_map(|item| item.as_str().map(str::to_owned))
        .collect();
    (!items.is_empty()).then(|| items.join(separator))
}

/// Text or number of a field, or an empty string when missing.
pub fn f(value: &Value, key: &str) -> String {
    field(value, key).unwrap_or_default()
}
