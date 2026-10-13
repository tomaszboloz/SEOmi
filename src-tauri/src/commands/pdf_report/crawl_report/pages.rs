use super::data::{list, num, page_url};
use super::strings::report as s;
use super::tables::{status_cell, Table};
use crate::commands::pdf_report::audit_report::ctx::{field, format_number};
use crate::commands::pdf_report::audit_report::model::Sev;
use crate::commands::pdf_report::layout::table::Cell;
use crate::commands::pdf_report::layout::text::dash;
use serde_json::Value;

const COLUMNS: [(&str, f32); 8] = [
    (s::COL_URL, 22.0),
    (s::COL_STATUS, 7.0),
    (s::COL_INDEXABILITY, 20.0),
    (s::COL_TITLE, 20.0),
    (s::COL_DEPTH, 6.0),
    (s::COL_TIME, 8.0),
    (s::COL_WORDS, 8.0),
    (s::COL_ISSUES, 9.0),
];

fn number(page: &Value, key: &str) -> String {
    num(page, key).map(format_number).unwrap_or_default()
}

/// Every crawled page in one table (never truncated).
pub fn pages_table(pages: &[Value]) -> Table {
    let rows = pages
        .iter()
        .map(|page| {
            let count = num(page, "issues_count")
                .map_or_else(|| list(page, "issues").len().to_string(), format_number);
            vec![
                Cell::new(dash(&page_url(page))),
                status_cell(num(page, "http_status").map(format_number)),
                Cell::new(dash(
                    &field(page, "indexability_status").unwrap_or_default(),
                )),
                Cell::new(dash(&field(page, "title").unwrap_or_default())),
                Cell::new(dash(&number(page, "depth"))),
                Cell::new(dash(&number(page, "response_time_ms"))),
                Cell::new(dash(&number(page, "word_count"))),
                Cell::new(count),
            ]
        })
        .collect();
    let mut table = Table::new(s::T_PAGES, Some(s::PAGES_INTRO.into()), &COLUMNS, rows);
    table.omitted = 0;
    table
}

/// Pages with Critical findings and those findings.
pub fn critical_table(pages: &[Value]) -> Table {
    let rows = pages
        .iter()
        .filter_map(|page| {
            let items: Vec<String> = list(page, "issues")
                .iter()
                .filter(|i| Sev::parse(&field(i, "severity").unwrap_or_default()) == Sev::Critical)
                .map(|i| field(i, "message").unwrap_or_default())
                .collect();
            (!items.is_empty()).then(|| {
                vec![
                    Cell::new(page_url(page)),
                    status_cell(num(page, "http_status").map(format_number)),
                    Cell::new(dash(&number(page, "depth"))),
                    Cell::new(items.join("   ")),
                ]
            })
        })
        .collect();
    let columns = [
        (s::COL_URL, 36.0),
        (s::COL_STATUS, 8.0),
        (s::COL_DEPTH, 8.0),
        (s::COL_CRITICAL, 48.0),
    ];
    let mut table = Table::new(
        s::CRITICAL_PAGES,
        Some(s::CRITICAL_INTRO.into()),
        &columns,
        rows,
    );
    table.omitted = 0;
    table
}
