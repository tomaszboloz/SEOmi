use super::ctx::{field, list_at};
use super::strings::{loc as l, t};
use serde_json::Value;

pub fn structured_items(audit: &Value, params: Option<&Value>) -> Vec<String> {
    let detail = params.and_then(|value| field(value, "detail"));
    let mut items = Vec::new();
    for block in list_at(audit, "/structured_data") {
        let kind = t(
            l::BLOCK,
            &[
                &field(block, "format").unwrap_or_default(),
                &field(block, "data_type").unwrap_or_default(),
            ],
        );
        for issue in list_at(block, "/validation_issues") {
            if detail.is_none() || field(issue, "message") == detail {
                let path = field(issue, "path").unwrap_or_else(|| l::NO_PATH.into());
                items.push(t(l::BLOCK_PATH, &[&kind, &path]));
            }
        }
    }
    items
}

pub fn evidence_items(audit: &Value, list: &str, code: &str) -> Vec<String> {
    let mut items = Vec::new();
    for finding in list_at(audit, list)
        .iter()
        .filter(|f| field(f, "code").as_deref() == Some(code))
    {
        let elements = list_at(finding, "/elements");
        for element in elements {
            let query = field(element, "dom_query").unwrap_or_default();
            let snippet = field(element, "html_snippet").unwrap_or_default();
            let place = match (field(element, "line"), field(element, "column")) {
                (Some(line), Some(column)) => t(l::LINE_COLUMN, &[&line, &column]),
                _ => String::new(),
            };
            items.push(t(l::ELEMENT_AT, &[&query, &place, &snippet]));
        }
        if elements.is_empty() {
            items.push(t(
                l::EVIDENCE,
                &[&field(finding, "evidence").unwrap_or_default()],
            ));
        }
    }
    items
}
