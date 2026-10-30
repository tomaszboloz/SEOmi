//! User-defined segments of a multi-topic site, each scored against its own
//! core topic (#82 GEM-82-05). A segment without a scored page shows a dash,
//! never 0.

use super::data::list;
use super::focus_text::arg;
use super::strings::focus as f;
use super::strings::{report as s, t};
use super::tables::Table;
use serde_json::Value;

pub fn segments(focus: &Value) -> Option<Table> {
    let rows: Vec<Vec<String>> = list(focus, "segments")
        .iter()
        .map(|item| {
            let scored = format!("{}/{}", arg(item.get("scored")), arg(item.get("pages")));
            vec![
                arg(item.get("label")),
                arg(item.get("path_prefix")),
                arg(item.get("core")),
                scored,
                arg(item.get("score")),
            ]
        })
        .collect();
    if rows.is_empty() {
        return None;
    }
    let columns = [
        (t(f::COL_SEGMENT), 22.0),
        (t(f::COL_PREFIX), 20.0),
        (t(f::COL_CORE), 32.0),
        (t(s::COL_PAGES), 13.0),
        (t(f::COL_SCORE), 13.0),
    ];
    Some(Table::text(
        t(f::T_SEGMENTS),
        Some(t(f::SEGMENTS_INTRO).into()),
        &columns,
        rows,
    ))
}
