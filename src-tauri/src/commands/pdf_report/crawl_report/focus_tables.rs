//! Tables of the Site Focus section.

use super::data::{list, page_url};
use super::focus_text::{arg, coded, from_params, percent};
use super::strings::focus::{self as f, OPTION, OPTIONS, REC, RECS, STATUS, TYPE};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use crate::commands::pdf_report::layout::color::{CRITICAL, OK, WARNING};
use crate::commands::pdf_report::layout::table::Cell;
use crate::commands::pdf_report::layout::text::{dash, Style};
use serde_json::Value;

fn trs_cell(page: &Value) -> Cell {
    let trs = page.get("trs").and_then(Value::as_f64);
    let color = match trs {
        Some(v) if v >= 75.0 => OK,
        Some(v) if v >= 60.0 => WARNING,
        _ => CRITICAL,
    };
    Cell::styled(
        arg(page.get("trs")),
        Style::BODY.colored(color).bold(),
        None,
    )
}

fn playbook(page: &Value) -> String {
    let book = page.get("playbook");
    let options: Vec<String> = list(book.unwrap_or(&Value::Null), "options")
        .iter()
        .filter_map(|option| {
            let code = field(option, "code")?;
            Some(from_params(OPTION, OPTIONS, &code, option.get("params")))
        })
        .collect();
    let kind = arg(book.and_then(|b| b.get("type")));
    tf(t(f::PLAYBOOK), &[&kind, &options.join("; ")])
}

/// Weakest content pages with scores and the suggested playbook.
pub fn pages(focus: &Value) -> Table {
    let rows = list(focus, "pages")
        .iter()
        .map(|page| {
            let text =
                |key: &str, prefix: &str| coded(prefix, &field(page, key).unwrap_or_default(), &[]);
            vec![
                Cell::new(dash(&page_url(page))),
                Cell::new(text("type", TYPE)),
                trs_cell(page),
                Cell::new(percent(page.get("similarity"))),
                Cell::new(percent(page.get("overlap"))),
                Cell::new(percent(page.get("drift"))),
                Cell::new(text("status", STATUS)),
                Cell::new(playbook(page)),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 21.0),
        (t(f::COL_TYPE), 8.0),
        (t(f::COL_TRS), 6.0),
        (t(f::COL_SIMILARITY), 9.0),
        (t(f::COL_OVERLAP), 8.0),
        (t(f::COL_DRIFT), 7.0),
        (t(s::COL_STATUS), 11.0),
        (t(f::COL_PLAYBOOK), 30.0),
    ];
    Table::new(
        t(f::T_PAGES),
        Some(t(f::PAGES_INTRO).into()),
        &columns,
        rows,
    )
}

/// Site-wide recommendations in the engine's priority order.
pub fn recommendations(focus: &Value) -> Table {
    let rows = list(focus, "recommendations")
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
    Table::text(t(f::T_RECS), Some(t(f::RECS_INTRO).into()), &columns, rows)
}

/// Topic areas of a multi-topic site with their own scores.
pub fn sub_sites(focus: &Value) -> Table {
    let rows = list(focus, "sub_sites")
        .iter()
        .map(|site| {
            vec![
                arg(site.get("label")),
                arg(site.get("path_prefix")),
                percent(site.get("share_pct")),
                arg(site.get("score")),
            ]
        })
        .collect();
    let columns = [
        (t(f::COL_AREA), 40.0),
        (t(f::COL_PREFIX), 25.0),
        (t(f::COL_SHARE), 20.0),
        (t(f::COL_SCORE), 15.0),
    ];
    Table::text(t(f::T_SUB), Some(t(f::SUB_INTRO).into()), &columns, rows)
}

/// Topic gaps and competitor terms missing on the site.
pub fn gaps(focus: &Value) -> Table {
    let rows = list(focus, "gaps")
        .iter()
        .map(|gap| {
            let terms = list(gap, "terms")
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(", ");
            let args = [
                arg(gap.get("label")),
                arg(gap.get("coverage_pct")),
                arg(gap.get("pages_covering")),
                dash(&terms),
            ];
            vec![coded(
                f::GAP,
                &field(gap, "code").unwrap_or_default(),
                &args,
            )]
        })
        .collect();
    Table::text(t(f::T_GAPS), None, &[(t(f::COL_GAP), 100.0)], rows)
}
