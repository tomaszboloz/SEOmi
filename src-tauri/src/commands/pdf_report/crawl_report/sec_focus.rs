//! "Site Focus" section: score card, core topic, notes and the tables.

use super::data::{list, num};
use super::focus_cards::{core_card, count, kpis};
use super::focus_tables as tables;
use super::focus_text::{arg, coded};
use super::strings::focus::{self as f, BAND, NOTE};
use super::strings::t;
use crate::commands::pdf_report::layout::color::{Rgb, CRITICAL, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;
use serde_json::Value;

const DARK_GREEN: Rgb = Rgb(0x15, 0x80, 0x3D);
const YELLOW: Rgb = Rgb(0xCA, 0x8A, 0x04);

/// Colour of a score band: dark green, green, yellow, orange, red.
pub fn band_color(band: &str) -> Rgb {
    match band {
        "excellent" => DARK_GREEN,
        "good" => OK,
        "moderate" => YELLOW,
        "weak" => WARNING,
        "critical" => CRITICAL,
        _ => MUTED,
    }
}

/// Warnings that qualify the score, in the order the app shows them.
pub fn notes(focus: &Value) -> Vec<String> {
    let on = |key: &str| {
        focus
            .pointer(&format!("/flags/{key}"))
            .is_some_and(|v| v.as_bool() == Some(true))
    };
    let sub_sites = list(focus, "sub_sites").len().to_string();
    let mut notes = Vec::new();
    if on("low_confidence") {
        notes.push(coded(NOTE, "lowConfidence", &[arg(count(focus, "scored"))]));
    }
    if on("multi_topic") {
        notes.push(coded(NOTE, "multiTopic", &[sub_sites]));
    }
    if on("lexical_fallback") {
        notes.push(coded(NOTE, "lexicalFallback", &[]));
    }
    let timeouts = focus.pointer("/flags/skipped_render_timeouts");
    if num(
        focus.get("flags").unwrap_or(&Value::Null),
        "skipped_render_timeouts",
    )
    .unwrap_or(0.0)
        > 0.0
    {
        notes.push(coded(NOTE, "skippedRender", &[arg(timeouts)]));
    }
    if on("degraded") {
        notes.push(coded(NOTE, "degraded", &[]));
    }
    let core = focus.get("core_topic").unwrap_or(&Value::Null);
    if core
        .get("manual_matched")
        .is_some_and(|v| v.as_bool() == Some(false))
    {
        notes.push(coded(
            NOTE,
            "unmatchedTopic",
            &[arg(core.get("manual_input"))],
        ));
    }
    notes
}

impl Doc {
    /// Site Focus Score section built from the `focus` summary of a crawl run.
    pub fn crawl_focus(&mut self, focus: &Value) {
        self.heading(t(f::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(f::INTRO));
        self.skip(6.0);
        let code = focus
            .get("band")
            .and_then(Value::as_str)
            .unwrap_or_default();
        self.ensure(90.0);
        self.score_panel_colored(
            band_color(code),
            num(focus, "score"),
            &coded(BAND, code, &[]),
            t(f::SCORE_TITLE),
            t(f::LEGEND),
        );
        self.kpi_grid(&kpis(focus));
        self.card(&core_card(focus));
        for note in notes(focus) {
            self.paragraph(MARGIN, CONTENT_W, Style::BODY.colored(WARNING), &note);
            self.skip(4.0);
        }
        self.skip(6.0);
        self.data_table(&tables::pages(focus));
        self.data_table(&tables::recommendations(focus));
        if !list(focus, "sub_sites").is_empty() {
            self.data_table(&tables::sub_sites(focus));
        }
        if !list(focus, "gaps").is_empty() {
            self.data_table(&tables::gaps(focus));
        }
    }
}

/// Whether the run carries a Site Focus summary the template allows.
pub fn present(run: &Value) -> bool {
    run.get("focus").is_some_and(Value::is_object) && super::detail_tables::allows(run, "focus")
}
