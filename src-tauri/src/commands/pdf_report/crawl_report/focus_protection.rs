//! URL protection table of the Site Focus section (#81): decision, every reason, the raw
//! evidence (unknown stays unknown) and manual options with their conditions. Advisory only.

use super::data::list;
use super::focus_text::{arg, coded};
use super::strings::focus as f;
use super::strings::protection::{
    self as p, ALTERNATIVE, CONDITION, DECISION, REASON, SIGNAL, STATE,
};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;

fn codes(value: &Value, key: &str) -> Vec<String> {
    list(value, key)
        .iter()
        .filter_map(Value::as_str)
        .map(str::to_owned)
        .collect()
}

fn decision(row: &Value) -> String {
    let code = field(row, "decision").unwrap_or_default();
    let mut parts = vec![coded(DECISION, &code, &[])];
    if row.get("pri").is_some_and(Value::is_number) {
        parts.push(format!("PRI {}", arg(row.get("pri"))));
    }
    parts.extend(
        codes(row, "reasons")
            .iter()
            .map(|reason| coded(REASON, reason, &[])),
    );
    parts.join("; ")
}

fn evidence(item: &Value) -> String {
    let signal = coded(SIGNAL, &field(item, "signal").unwrap_or_default(), &[]);
    let state = coded(STATE, &field(item, "state").unwrap_or_default(), &[]);
    if !item.get("value").is_some_and(Value::is_number) {
        return tf(t(p::UNKNOWN), &[&signal, &state]);
    }
    let value = match field(item, "currency") {
        Some(currency) => format!("{} {currency}", arg(item.get("value"))),
        None => arg(item.get("value")),
    };
    tf(t(p::MEASURED), &[&signal, &value, &state])
}

fn option(item: &Value) -> String {
    let name = coded(ALTERNATIVE, &field(item, "code").unwrap_or_default(), &[]);
    let conditions: Vec<String> = codes(item, "conditions")
        .iter()
        .map(|code| coded(CONDITION, code, &[]))
        .collect();
    format!("{name} {}", tf(t(p::ONLY_IF), &[&conditions.join("; ")]))
}

/// One row per low-TRS URL the app checked; the intro states the inclusive thresholds.
pub fn protection(focus: &Value) -> Option<Table> {
    let data = focus.get("protection")?;
    let rows: Vec<Vec<String>> = list(data, "rows")
        .iter()
        .map(|row| {
            vec![
                arg(row.get("url")),
                arg(row.get("trs")),
                decision(row),
                list(row, "evidence")
                    .iter()
                    .map(evidence)
                    .collect::<Vec<_>>()
                    .join("; "),
                list(row, "advice")
                    .iter()
                    .map(option)
                    .collect::<Vec<_>>()
                    .join(" | "),
            ]
        })
        .collect();
    if rows.is_empty() {
        return None;
    }
    let mut intro = tf(
        t(p::INTRO),
        &[
            &arg(data.get("trs_threshold")),
            &arg(data.get("pri_threshold")),
        ],
    );
    if data.get("telemetry").and_then(Value::as_bool) != Some(true) {
        intro = format!("{intro} {}", t(p::NO_TELEMETRY));
    }
    let columns = [
        (t(s::COL_URL), 22.0),
        (t(f::COL_TRS), 6.0),
        (t(p::COL_DECISION), 20.0),
        (t(p::COL_EVIDENCE), 24.0),
        (t(p::COL_OPTIONS), 28.0),
    ];
    Some(Table::text(t(p::TITLE), Some(intro), &columns, rows))
}
