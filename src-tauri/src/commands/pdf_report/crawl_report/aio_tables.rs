//! Tables of the AI readiness section: weakest pages and weakest passages.

use super::data::{list, page_url};
use super::focus_text::{arg, coded};
use super::strings::aio::{self as a, ISSUE};
use super::strings::{report as s, t};
use super::tables::Table;
use crate::commands::pdf_report::layout::color::{CRITICAL, OK, WARNING};
use crate::commands::pdf_report::layout::table::Cell;
use crate::commands::pdf_report::layout::text::{dash, Style};
use serde_json::Value;

pub fn percent(value: Option<&Value>) -> String {
    super::strings::tf(t(a::PERCENT), &[&arg(value)])
}

fn score_cell(score: Option<&Value>) -> Cell {
    let color = match score.and_then(Value::as_f64) {
        Some(v) if v >= 75.0 => OK,
        Some(v) if v >= 60.0 => WARNING,
        _ => CRITICAL,
    };
    Cell::styled(arg(score), Style::BODY.colored(color).bold(), None)
}

pub fn pages_table(aio: &Value) -> Table {
    let rows = list(aio, "pages")
        .iter()
        .map(|page| {
            vec![
                Cell::new(dash(&page_url(page))),
                score_cell(page.get("score")),
                Cell::new(percent(page.get("self_containment"))),
                Cell::new(percent(page.get("spo_density"))),
                Cell::new(percent(page.get("extractability"))),
                Cell::new(arg(page.get("chunks"))),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 38.0),
        (t(a::COL_SCORE), 10.0),
        (t(a::COL_SELF), 14.0),
        (t(a::COL_SPO), 14.0),
        (t(a::COL_EXTRACT), 14.0),
        (t(a::COL_CHUNKS), 10.0),
    ];
    Table::new(
        t(a::T_PAGES),
        Some(t(a::PAGES_INTRO).into()),
        &columns,
        rows,
    )
}

pub fn passages_table(aio: &Value) -> Table {
    let rows = list(aio, "passages")
        .iter()
        .map(|passage| {
            let issues = list(passage, "issues")
                .iter()
                .filter_map(Value::as_str)
                .map(|code| coded(ISSUE, code, &[]))
                .collect::<Vec<_>>()
                .join("; ");
            vec![
                format!(
                    "{} {}",
                    dash(&page_url(passage)),
                    arg(passage.get("heading"))
                ),
                arg(passage.get("score")),
                arg(passage.get("excerpt")),
                issues,
            ]
        })
        .collect();
    let columns = [
        (t(a::COL_HEADING), 28.0),
        (t(a::COL_SCORE), 8.0),
        (t(a::COL_EXCERPT), 40.0),
        (t(a::COL_ISSUES), 24.0),
    ];
    Table::text(
        t(a::T_PASSAGES),
        Some(t(a::PASSAGES_INTRO).into()),
        &columns,
        rows,
    )
}
