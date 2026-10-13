use super::ctx::text_at;
use super::locate::where_items;
use super::strings::report as s;
use crate::commands::pdf_report::layout::color::{Rgb, CRITICAL, INFO, WARNING};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Sev {
    Critical,
    Warning,
    Info,
}

impl Sev {
    pub fn parse(value: &str) -> Sev {
        match value.to_lowercase().as_str() {
            "critical" | "error" => Sev::Critical,
            "warning" => Sev::Warning,
            _ => Sev::Info,
        }
    }

    pub fn color(self) -> Rgb {
        match self {
            Sev::Critical => CRITICAL,
            Sev::Warning => WARNING,
            Sev::Info => INFO,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Sev::Critical => s::SEV_CRITICAL,
            Sev::Warning => s::SEV_WARNING,
            Sev::Info => s::SEV_INFO,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Finding {
    pub sev: Sev,
    pub category: String,
    pub code: String,
    pub message: String,
    pub recommendation: String,
    pub location: Vec<String>,
}

/// Findings sorted Critical, Warning, Info and then by category.
pub fn findings(audit: &Value) -> Vec<Finding> {
    let items = audit.get("issues").and_then(Value::as_array);
    let mut list: Vec<Finding> = items
        .into_iter()
        .flatten()
        .map(|issue| {
            let code = text_at(issue, "/code").unwrap_or_default();
            Finding {
                sev: Sev::parse(&text_at(issue, "/severity").unwrap_or_default()),
                category: category_label(&text_at(issue, "/category").unwrap_or_default()),
                message: text_at(issue, "/message").unwrap_or_else(|| s::NO_MESSAGE.into()),
                recommendation: text_at(issue, "/recommendation")
                    .unwrap_or_else(|| s::NO_RECOMMENDATION.into()),
                location: where_items(audit, &code, issue.get("params")),
                code,
            }
        })
        .collect();
    list.sort_by(|a, b| (a.sev, &a.category).cmp(&(b.sev, &b.category)));
    list
}

/// Turns identifiers such as `MetaTags` into readable labels.
pub fn category_label(raw: &str) -> String {
    if raw.is_empty() {
        return s::CATEGORY_FALLBACK.into();
    }
    let mut label = String::new();
    for (index, character) in raw.chars().enumerate() {
        if index > 0 && character.is_uppercase() {
            label.push(' ');
            label.extend(character.to_lowercase());
        } else {
            label.push(character);
        }
    }
    label
}
