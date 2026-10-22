//! Tables of the Topical Authority section.

use super::data::list;
use super::focus_text::{arg, coded, from_params, percent};
use super::strings::authority::{self as a, LEVEL, REC, RECS};
use super::strings::focus::{self as f};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;

/// Coverage of every reference pillar by the site.
pub fn coverage(authority: &Value) -> Table {
    let rows = list(authority, "pillar_coverage")
        .iter()
        .map(|row| {
            vec![
                arg(row.get("label")),
                percent(row.get("coverage_pct")),
                arg(row.get("gaps")),
            ]
        })
        .collect();
    let columns = [
        (t(a::COL_PILLAR), 55.0),
        (t(a::COL_COVERAGE), 25.0),
        (t(a::COL_GAPS), 20.0),
    ];
    Table::text(t(a::T_COVERAGE), None, &columns, rows)
}

/// Reference sub-topics the site does not cover yet, most important first.
pub fn gaps(authority: &Value) -> Table {
    let rows = list(authority, "gaps")
        .iter()
        .map(|row| {
            let level = field(row, "level").unwrap_or_default();
            vec![
                arg(row.get("label")),
                coded(LEVEL, &level, &[]),
                percent(row.get("weight")),
            ]
        })
        .collect();
    let columns = [
        (t(a::COL_GAP), 60.0),
        (t(a::COL_LEVEL), 20.0),
        (t(f::COL_SHARE), 20.0),
    ];
    Table::text(t(a::T_GAPS), None, &columns, rows)
}

/// Pages that compete for one search intent, with the page to keep.
pub fn cannibalization(authority: &Value) -> Table {
    let rows = list(authority, "cannibalization")
        .iter()
        .map(|group| {
            vec![
                arg(group.get("canonical")),
                arg(group.get("pages")),
                percent(group.get("similarity")),
            ]
        })
        .collect();
    let columns = [
        (t(a::COL_CANONICAL), 64.0),
        (t(a::COL_PAGES), 16.0),
        (t(f::COL_SIMILARITY), 20.0),
    ];
    Table::text(t(a::T_CANNIBAL), None, &columns, rows)
}

/// Prioritised fixes with simulated TAS gain.
pub fn recommendations(authority: &Value) -> Table {
    let rows = list(authority, "recommendations")
        .iter()
        .enumerate()
        .map(|(index, rec)| {
            let code = field(rec, "code").unwrap_or_default();
            vec![
                (index + 1).to_string(),
                from_params(REC, RECS, &code, rec.get("params")),
                tf(t(f::GAIN), &[&arg(rec.get("gain"))]),
            ]
        })
        .collect();
    let columns = [
        (t(f::COL_NO), 6.0),
        (t(f::COL_ACTION), 80.0),
        (t(f::COL_GAIN), 14.0),
    ];
    Table::text(t(a::T_RECS), None, &columns, rows)
}

/// Topical gap matrix: SFS and TAS of the site against the top competitors.
pub fn benchmark(authority: &Value) -> Table {
    let rows = list(authority, "benchmark")
        .iter()
        .map(|row| {
            vec![
                arg(row.get("domain")),
                arg(row.get("sfs")),
                arg(row.get("tas")),
            ]
        })
        .collect();
    let columns = [(t(s::COL_URL), 60.0), ("SFS", 20.0), ("TAS", 20.0)];
    Table::text(t(a::T_BENCH), None, &columns, rows)
}
