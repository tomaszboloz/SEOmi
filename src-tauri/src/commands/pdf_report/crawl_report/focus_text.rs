//! Turns engine codes and their parameters into localized report text.

use super::strings::focus::Coded;
use super::strings::{t, tf};
use crate::commands::pdf_report::audit_report::ctx::format_number;
use crate::commands::pdf_report::layout::text::EMPTY;
use serde_json::Value;

/// A JSON scalar as label argument; missing values become the dash.
pub fn arg(value: Option<&Value>) -> String {
    match value {
        Some(Value::Number(n)) => n.as_f64().map_or_else(|| n.to_string(), format_number),
        Some(Value::String(text)) if !text.trim().is_empty() => text.trim().to_owned(),
        _ => EMPTY.to_owned(),
    }
}

/// `<prefix>.<code>` label with `args`; an unknown code is shown as is.
pub fn coded(prefix: &str, code: &str, args: &[String]) -> String {
    let key = format!("{prefix}.{code}");
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let text = tf(&key, &refs);
    if text == key {
        code.to_owned()
    } else {
        text
    }
}

/// Label of a coded item whose parameters sit in `params`, ordered by `table`.
pub fn from_params(prefix: &str, table: &[Coded], code: &str, params: Option<&Value>) -> String {
    let names = table
        .iter()
        .find(|(known, _)| *known == code)
        .map_or(&[][..], |(_, names)| *names);
    let args: Vec<String> = names
        .iter()
        .map(|name| arg(params.and_then(|p| p.get(*name))))
        .collect();
    coded(prefix, code, &args)
}

/// `{{0}}%` style helper for plain percentages.
pub fn percent(value: Option<&Value>) -> String {
    tf(t(super::strings::focus::PERCENT), &[&arg(value)])
}
