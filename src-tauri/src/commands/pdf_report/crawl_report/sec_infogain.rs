//! "Information Gain" section: score card, component KPIs, weakest pages and recommendations.

use super::data::{list, num};
use super::focus_text::{arg, coded, from_params, percent};
use super::strings::infogain::{self as g, BAND, NOTE, RECS, REC};
use super::strings::{report as s, t, tf};
use super::tables::Table;
use crate::commands::pdf_report::audit_report::ctx::field;
use crate::commands::pdf_report::layout::color::{Rgb, CRITICAL, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::{dash, Style};
use crate::commands::pdf_report::layout::widgets::Kpi;
use serde_json::Value;

const DARK_GREEN: Rgb = Rgb(0x15, 0x80, 0x3D);
const YELLOW: Rgb = Rgb(0xCA, 0x8A, 0x04);

/// Colour of the score band: dark green, green, yellow, orange, red.
pub fn band_color(band: &str) -> Rgb {
    match band {
        "original" => DARK_GREEN,
        "good" => OK,
        "average" => YELLOW,
        "derivative" => WARNING,
        "echo" => CRITICAL,
        _ => MUTED,
    }
}

fn flag(summary: &Value, key: &str) -> bool {
    summary.pointer(&format!("/flags/{key}")).is_some_and(|v| v.as_bool() == Some(true))
}

/// Warnings that qualify the score, in the order the app shows them.
pub fn notes(summary: &Value) -> Vec<String> {
    let mut out = Vec::new();
    if flag(summary, "thin_baseline") {
        out.push(coded(NOTE, "thinBaseline", &[arg(summary.get("baseline_docs"))]));
    }
    if summary.pointer("/flags/fhem_unavailable_pages").and_then(Value::as_f64).unwrap_or(0.0) > 0.0 {
        out.push(coded(NOTE, "fhemUnavailable", &[arg(summary.pointer("/flags/fhem_unavailable_pages"))]));
    }
    if summary.pointer("/flags/truncated").and_then(Value::as_f64).unwrap_or(0.0) > 0.0 {
        out.push(coded(NOTE, "truncated", &[arg(summary.pointer("/flags/truncated"))]));
    }
    out
}

fn kpis(summary: &Value) -> Vec<Kpi> {
    let part = |key: &str| summary.pointer(&format!("/parts/{key}"));
    let zone = |key: &str| summary.pointer(&format!("/zones/{key}"));
    let item = |label, value: String, note: &str, color| Kpi { label, value, note: t(note).into(), color };
    let fhem = part("fhem").filter(|v| !v.is_null());
    vec![
        item(t(g::K_NEFR), percent(part("nefr")), g::N_NEFR, MUTED),
        item(t(g::K_EDSI), percent(part("edsi")), g::N_EDSI, MUTED),
        item(t(g::K_FHEM), fhem.map_or_else(|| arg(None), |v| percent(Some(v))), g::N_FHEM, MUTED),
        item(t(g::K_SDD), percent(part("sdd")), g::N_SDD, MUTED),
        item(t(g::K_GAIN), percent(zone("gain")), g::N_GAIN, OK),
        item(t(g::K_ECHO), percent(zone("echo")), g::N_ECHO, MUTED),
        item(t(g::K_DRIFT), percent(zone("drift")), g::N_DRIFT, CRITICAL),
    ]
}

/// Pages that repeat the search results the most.
pub fn pages(summary: &Value) -> Table {
    let rows = list(summary, "pages")
        .iter()
        .map(|page| {
            vec![
                dash(&field(page, "url").unwrap_or_default()),
                arg(page.get("score")),
                coded(BAND, &field(page, "band").unwrap_or_default(), &[]),
                percent(page.get("echo")),
                percent(page.get("gain")),
                percent(page.get("drift")),
            ]
        })
        .collect();
    let columns = [
        (t(s::COL_URL), 40.0),
        (t(g::COL_SCORE), 9.0),
        (t(g::COL_BAND), 19.0),
        (t(g::COL_ECHO), 10.0),
        (t(g::COL_GAIN), 11.0),
        (t(g::COL_DRIFT), 11.0),
    ];
    Table::text(t(g::T_PAGES), Some(t(g::PAGES_INTRO).into()), &columns, rows)
}

/// Site-wide recommendations, most frequent first.
pub fn recommendations(summary: &Value) -> Table {
    let rows = list(summary, "recommendations")
        .iter()
        .enumerate()
        .map(|(index, rec)| {
            let code = field(rec, "code").unwrap_or_default();
            vec![(index + 1).to_string(), from_params(REC, RECS, &code, rec.get("params"))]
        })
        .collect();
    let columns = [(t(g::COL_NO), 6.0), (t(g::COL_ACTION), 94.0)];
    Table::text(t(g::T_RECS), Some(t(g::RECS_INTRO).into()), &columns, rows)
}

impl Doc {
    /// Information Gain & Originality section built from the `info_gain` summary of a crawl run.
    pub fn crawl_info_gain(&mut self, summary: &Value) {
        self.heading(t(g::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(g::INTRO));
        self.skip(6.0);
        let code = summary.get("band").and_then(Value::as_str).unwrap_or_default();
        self.ensure(90.0);
        self.score_panel_colored(band_color(code), num(summary, "score"), &coded(BAND, code, &[]), t(g::SCORE_TITLE), t(g::LEGEND));
        self.paragraph(
            MARGIN,
            CONTENT_W,
            Style::CAPTION,
            &tf(t(g::BASIS), &[&arg(summary.get("evaluated")), &arg(summary.get("baseline_docs")), &arg(summary.get("source"))]),
        );
        self.skip(4.0);
        self.kpi_grid(&kpis(summary));
        for note in notes(summary) {
            self.paragraph(MARGIN, CONTENT_W, Style::BODY.colored(WARNING), &note);
            self.skip(4.0);
        }
        self.skip(6.0);
        self.data_table(&pages(summary));
        if !list(summary, "recommendations").is_empty() {
            self.data_table(&recommendations(summary));
        }
    }
}

/// Whether the run carries an Information Gain summary and the template allows it.
pub fn present(run: &Value) -> bool {
    run.get("info_gain").is_some_and(Value::is_object) && super::detail_tables::allows(run, "infoGain")
}
