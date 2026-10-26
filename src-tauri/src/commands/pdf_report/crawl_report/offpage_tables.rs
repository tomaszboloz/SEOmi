use super::data::OffPage;
use super::strings::{offpage as o, report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use serde_json::Value;

pub fn bounded(text: &str, limit: usize) -> String {
    if text.chars().count() > limit {
        format!("{}…", text.chars().take(limit - 1).collect::<String>())
    } else {
        text.to_owned()
    }
}

pub fn value(data: &Value, key: &str) -> String {
    field(data, key).map_or_else(|| t(o::NA).into(), |text| bounded(&text, 240))
}

pub fn sources(off_page: &OffPage) -> Table {
    let rows = off_page
        .sources
        .iter()
        .take(10)
        .map(|source| {
            ["url", "authority", "similarity", "contribution"]
                .iter()
                .map(|key| value(source, key))
                .collect()
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 49.0),
        (t(o::AUTHORITY), 17.0),
        (t(o::SIMILARITY), 17.0),
        (t(o::CONTRIBUTION), 17.0),
    ];
    Table::text(
        t(o::T_SOURCES),
        Some(t(o::SOURCES_INTRO).into()),
        &columns,
        rows,
    )
}

pub fn citations(off_page: &OffPage) -> Table {
    let rows = off_page
        .co_citations
        .iter()
        .take(5)
        .map(|hit| {
            vec![
                value(hit, "url"),
                value(hit, "offset"),
                bounded(
                    &field(hit, "excerpt").unwrap_or_else(|| t(o::NA).into()),
                    300,
                ),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 35.0),
        (t(o::OFFSET), 12.0),
        (t(o::EXCERPT), 53.0),
    ];
    Table::text(t(o::T_CITATIONS), None, &columns, rows)
}
