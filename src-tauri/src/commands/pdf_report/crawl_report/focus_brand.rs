//! Site Focus provenance pieces: scoring profile line (#83) and the competitor
//! terms hidden from the gap list as brand noise, with the reason (#56).

use super::data::list;
use super::focus_text::{arg, coded};
use super::strings::focus::{self as f, BRAND_REASON};
use super::strings::{t, tf};
use super::tables::Table;
use serde_json::Value;

/// "Scoring profile <version>, configuration <hash>"; None for summaries without a profile.
pub fn profile_line(focus: &Value) -> Option<String> {
    let profile = focus.get("profile").filter(|v| v.is_object())?;
    Some(tf(
        t(f::PROFILE),
        &[
            &arg(profile.get("algorithm_version")),
            &arg(profile.get("config_hash")),
        ],
    ))
}

/// Competitor terms that were not reported as gaps because they name a brand.
pub fn hidden_gaps(focus: &Value) -> Option<Table> {
    let rows: Vec<Vec<String>> = list(focus, "brand_filtered")
        .iter()
        .map(|item| {
            let reason = item
                .get("reason")
                .and_then(Value::as_str)
                .unwrap_or_default();
            vec![arg(item.get("term")), coded(BRAND_REASON, reason, &[])]
        })
        .collect();
    if rows.is_empty() {
        return None;
    }
    let columns = [(t(f::COL_TERM), 50.0), (t(f::COL_REASON), 50.0)];
    Some(Table::text(
        t(f::T_HIDDEN),
        Some(t(f::HIDDEN_INTRO).into()),
        &columns,
        rows,
    ))
}
