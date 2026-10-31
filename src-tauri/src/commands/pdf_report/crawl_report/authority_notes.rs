//! Data-source notes of the Topical Authority section: People Also Ask source and
//! partial entity depth, worded exactly as the UI states them (#62 GEM-62-05).

use super::focus_text::{arg, coded};
use super::strings::authority::{self as a, DEPTH_PART};
use super::strings::{t, tf};
use serde_json::Value;

/// Caption lines for the reference map inputs; empty when there is no map.
pub fn input_notes(authority: &Value) -> Vec<String> {
    let mut notes = Vec::new();
    if let Some(reference) = authority.get("reference").filter(|v| v.is_object()) {
        match reference.get("paa").and_then(Value::as_f64) {
            Some(count) if count > 0.0 => {
                notes.push(tf(t(a::PAA_USED), &[&arg(reference.get("paa"))]))
            }
            _ => notes.push(t(a::PAA_MISSING).to_owned()),
        }
    }
    let inputs = authority.get("depth_inputs");
    if inputs.and_then(|v| v.get("status")).and_then(Value::as_str) == Some("partial") {
        let parts: Vec<String> = inputs
            .and_then(|v| v.get("missing"))
            .and_then(Value::as_array)
            .map(|list| {
                list.iter()
                    .filter_map(Value::as_str)
                    .map(|code| coded(DEPTH_PART, code, &[]))
                    .collect()
            })
            .unwrap_or_default();
        let rows = arg(inputs.and_then(|v| v.get("rows")));
        notes.push(tf(t(a::CDES_PARTIAL), &[&parts.join(", "), &rows]));
    }
    notes
}
