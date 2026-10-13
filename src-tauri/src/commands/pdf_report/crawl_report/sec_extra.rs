use super::data::{f, list, Crawl};
use super::strings::report as s;
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;

pub fn frames_and_searches(c: &Crawl) -> Vec<Table> {
    let mut frames = Vec::new();
    let mut searches = Vec::new();
    for page in c.pages {
        for frame in list(page, "frames") {
            let src = field(frame, "resolved_url")
                .or_else(|| field(frame, "src"))
                .unwrap_or_default();
            frames.push(vec![
                f(page, "url"),
                src,
                f(frame, "title"),
                f(frame, "http_status"),
            ]);
        }
        for search in list(page, "custom_search_results") {
            let values = list(search, "values")
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("; ");
            searches.push(vec![
                f(page, "url"),
                f(search, "id"),
                values,
                f(search, "error"),
            ]);
        }
    }
    let fc = [
        (s::COL_URL, 30.0),
        (s::COL_FRAME, 40.0),
        (s::COL_TITLE, 20.0),
        (s::COL_STATUS, 10.0),
    ];
    let sc = [
        (s::COL_URL, 30.0),
        (s::COL_SEARCH, 14.0),
        (s::COL_FOUND, 40.0),
        (s::COL_ERROR, 16.0),
    ];
    vec![
        Table::text(s::T_FRAMES, None, &fc, frames),
        Table::text(s::T_SEARCHES, None, &sc, searches),
    ]
}
