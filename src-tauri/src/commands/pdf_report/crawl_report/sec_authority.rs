//! "Topical Authority" section: TAS score panel, component KPIs, notes and tables.

use super::authority_notes::input_notes;
use super::authority_tables as tables;
use super::data::{list, num};
use super::focus_text::{arg, coded, percent};
use super::sec_focus::band_color;
use super::strings::authority::{self as a, QUADRANT, WARNING};
use super::strings::{t, tf};
use crate::commands::pdf_report::layout::color::{MUTED, WARNING as WARN_COLOR};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;
use crate::commands::pdf_report::layout::widgets::Kpi;
use serde_json::Value;

/// Band colour of a 0-100 TAS value (same bands as the Site Focus Score).
fn band(value: Option<f64>) -> &'static str {
    match value {
        Some(v) if v >= 90.0 => "excellent",
        Some(v) if v >= 75.0 => "good",
        Some(v) if v >= 60.0 => "moderate",
        Some(v) if v >= 40.0 => "weak",
        Some(_) => "critical",
        None => "",
    }
}

fn pillar(authority: &Value, key: &str) -> String {
    match authority.pointer(&format!("/pillars/{key}")) {
        Some(Value::Number(_)) => percent(authority.pointer(&format!("/pillars/{key}"))),
        _ => t(a::UNAVAILABLE).to_owned(),
    }
}

fn kpis(authority: &Value) -> Vec<Kpi> {
    let item = |label, key: &str| Kpi {
        label,
        value: pillar(authority, key),
        note: String::new(),
        color: MUTED,
    };
    vec![
        item(t(a::K_TCR), "tcr"),
        item(t(a::K_CDES), "cdes"),
        item(t(a::K_SILC), "silc"),
        item(t(a::K_CVFF), "cvff"),
    ]
}

impl Doc {
    /// Topical Authority section built from the `authority` summary of a crawl run.
    pub fn crawl_authority(&mut self, authority: &Value) {
        self.heading(t(a::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(a::INTRO));
        self.skip(6.0);
        let tas = num(authority, "tas");
        let quadrant = authority
            .get("quadrant")
            .and_then(Value::as_str)
            .map(|code| coded(QUADRANT, code, &[]))
            .unwrap_or_default();
        self.ensure(90.0);
        self.score_panel_colored(
            band_color(band(tas)),
            tas,
            &quadrant,
            t(a::SCORE_TITLE),
            t(a::LEGEND),
        );
        self.kpi_grid(&kpis(authority));
        match authority.get("reference").filter(|v| v.is_object()) {
            Some(reference) => {
                let args: Vec<String> = ["subtopics", "pillars", "competitors", "source"]
                    .iter()
                    .map(|key| arg(reference.get(*key)))
                    .collect();
                let refs: Vec<&str> = args.iter().map(String::as_str).collect();
                self.paragraph(
                    MARGIN,
                    CONTENT_W,
                    Style::CAPTION,
                    &tf(t(a::REFERENCE), &refs),
                );
            }
            None => self.paragraph(
                MARGIN,
                CONTENT_W,
                Style::BODY.colored(WARN_COLOR),
                t(a::NO_REFERENCE),
            ),
        }
        for note in input_notes(authority) {
            self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, &note);
        }
        self.skip(4.0);
        for warning in list(authority, "warnings").iter().filter_map(Value::as_str) {
            self.paragraph(
                MARGIN,
                CONTENT_W,
                Style::BODY.colored(WARN_COLOR),
                &coded(WARNING, warning, &[]),
            );
            self.skip(4.0);
        }
        self.skip(6.0);
        if !list(authority, "pillar_coverage").is_empty() {
            self.data_table(&tables::coverage(authority));
        }
        if !list(authority, "gaps").is_empty() {
            self.data_table(&tables::gaps(authority));
        }
        if !list(authority, "cannibalization").is_empty() {
            self.data_table(&tables::cannibalization(authority));
        }
        if !list(authority, "recommendations").is_empty() {
            self.data_table(&tables::recommendations(authority));
        }
        if !list(authority, "benchmark").is_empty() {
            self.data_table(&tables::benchmark(authority));
        }
    }
}

/// Whether the run carries an authority summary and the template allows it.
pub fn present(run: &Value) -> bool {
    run.get("authority").is_some_and(Value::is_object)
        && super::detail_tables::allows(run, "authority")
}
