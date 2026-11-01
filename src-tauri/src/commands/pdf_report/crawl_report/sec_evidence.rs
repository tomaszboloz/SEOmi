use super::data::list;
use super::detail_tables::allows;
use super::focus_text::coded;
use super::offpage_tables::{bounded, value};
use super::strings::{evidence as e, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;
use serde_json::Value;

const NA_KEY: &str = "n/a";

fn cell(data: &Value, key: &str) -> String {
    let shown = value(data, key);
    if shown == t(super::strings::offpage::NA) {
        t(e::NA).to_owned()
    } else {
        shown
    }
}

fn effect(row: &Value) -> String {
    let part = |key: &str| row.get(key).and_then(Value::as_f64);
    match (part("effect"), part("lower"), part("upper")) {
        (Some(effect), Some(lower), Some(upper)) => {
            format!("{effect:+.0} [{lower:+.0}; {upper:+.0}]")
        }
        _ => t(e::NA).to_owned(),
    }
}

pub fn revenue(data: &Value) -> Table {
    let period = data.get("period").and_then(Value::as_str).unwrap_or(NA_KEY);
    let rows = list(data, "pages")
        .iter()
        .map(|row| vec![cell(row, "page"), cell(row, "revenue")])
        .collect();
    let intro = tf(
        t(e::REVENUE_INTRO),
        &[&cell(data, "currency"), &cell(data, "attribution"), period],
    );
    Table::text(
        t(e::T_REVENUE),
        Some(intro),
        &[(t(e::COL_PAGE), 70.0), (t(e::COL_REVENUE), 30.0)],
        rows,
    )
}

pub fn experiments(rows: &[Value]) -> Table {
    let body = rows
        .iter()
        .map(|row| {
            let probability = row
                .get("probability")
                .and_then(Value::as_f64)
                .map_or_else(|| t(e::NA).to_owned(), |p| format!("{:.0}%", p * 100.0));
            vec![
                bounded(&cell(row, "target"), 80),
                cell(row, "date"),
                coded(e::METHOD, &cell(row, "method"), &[]),
                coded(e::STATUS, &cell(row, "status"), &[]),
                effect(row),
                probability,
            ]
        })
        .collect();
    let columns = [
        (t(e::COL_TARGET), 30.0),
        (t(e::COL_DATE), 12.0),
        (t(e::COL_METHOD), 14.0),
        (t(e::COL_STATUS), 14.0),
        (t(e::COL_EFFECT), 20.0),
        (t(e::COL_PROBABILITY), 10.0),
    ];
    Table::text(
        t(e::T_EXPERIMENTS),
        Some(t(e::EXPERIMENTS_INTRO).into()),
        &columns,
        body,
    )
}

pub fn decay(rows: &[Value]) -> Table {
    let body = rows
        .iter()
        .map(|row| {
            let shift = row
                .get("centroid_shift")
                .and_then(Value::as_f64)
                .map_or_else(|| t(e::NA).to_owned(), |s| format!("{s:.3}"));
            let entities = format!(
                "+{} / -{}",
                cell(row, "new_entities"),
                cell(row, "lost_entities")
            );
            vec![
                bounded(&cell(row, "query"), 80),
                coded(e::VERDICT, &cell(row, "verdict"), &[]),
                cell(row, "samples"),
                shift,
                entities,
            ]
        })
        .collect();
    let columns = [
        (t(e::COL_QUERY), 34.0),
        (t(e::COL_VERDICT), 20.0),
        (t(e::COL_SAMPLES), 12.0),
        (t(e::COL_SHIFT), 14.0),
        (t(e::COL_ENTITIES), 20.0),
    ];
    Table::text(
        t(e::T_DECAY),
        Some(t(e::DECAY_INTRO).into()),
        &columns,
        body,
    )
}

impl Doc {
    /// Saved telemetry the report can cite: GA4 revenue, experiment estimates and SERP drift history (#91, #97, #98).
    pub fn crawl_evidence(&mut self, data: &Value) {
        self.heading(t(e::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(e::INTRO));
        if data.get("revenue").is_some_and(Value::is_object) {
            self.data_table(&revenue(&data["revenue"]));
        }
        if !list(data, "experiments").is_empty() {
            self.data_table(&experiments(list(data, "experiments")));
        }
        if !list(data, "decay").is_empty() {
            self.data_table(&decay(list(data, "decay")));
        }
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(e::DISCLAIMER));
    }
}

pub fn present(run: &Value) -> bool {
    run.get("evidence").is_some_and(Value::is_object) && allows(run, "evidence")
}
