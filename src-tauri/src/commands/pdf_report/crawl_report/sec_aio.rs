//! "AI Overviews & RAG readiness" section: score card, KPIs and the weakest pages/passages.

use super::aio_tables::{pages_table, passages_table, percent};
use super::data::{list, num};
use super::focus_text::{arg, coded};
use super::sec_focus::band_color;
use super::strings::aio::{self as a, BAND};
use super::strings::{t, tf};
use crate::commands::pdf_report::audit_report::ctx::field;
use crate::commands::pdf_report::layout::color::{MUTED, WARNING};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;
use crate::commands::pdf_report::layout::widgets::Kpi;
use serde_json::Value;

fn kpis(aio: &Value) -> Vec<Kpi> {
    let item = |label, key: &str, note| Kpi {
        label,
        value: percent(aio.get(key)),
        note: t(note).into(),
        color: MUTED,
    };
    vec![
        item(t(a::K_SELF), "self_containment", a::N_SELF),
        item(t(a::K_SPO), "spo_density", a::N_SPO),
        item(t(a::K_EXTRACT), "extractability", a::N_EXTRACT),
        Kpi {
            label: t(a::K_SCORED),
            value: arg(aio.get("scored")),
            note: tf(t(a::N_SCORED), &[&arg(aio.get("skipped"))]),
            color: MUTED,
        },
    ]
}

impl Doc {
    /// AI-readiness section built from the `aio` summary of a crawl run.
    pub fn crawl_aio(&mut self, aio: &Value) {
        self.heading(t(a::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(a::INTRO));
        self.skip(6.0);
        let code = field(aio, "band").unwrap_or_default();
        self.ensure(90.0);
        self.score_panel_colored(
            band_color(&code),
            num(aio, "score"),
            &coded(BAND, &code, &[]),
            t(a::SCORE_TITLE),
            t(a::LEGEND),
        );
        self.kpi_grid(&kpis(aio));
        let basic: Vec<&str> = list(aio, "basic_rule_languages")
            .iter()
            .filter_map(Value::as_str)
            .collect();
        if !basic.is_empty() {
            let note = tf(t(a::NOTE_BASIC), &[&basic.join(", ")]);
            self.paragraph(MARGIN, CONTENT_W, Style::BODY.colored(WARNING), &note);
            self.skip(4.0);
        }
        self.skip(6.0);
        self.data_table(&pages_table(aio));
        if !list(aio, "passages").is_empty() {
            self.data_table(&passages_table(aio));
        }
    }
}

/// Whether the run carries an AI-readiness summary the template allows.
pub fn present(run: &Value) -> bool {
    run.get("aio").is_some_and(Value::is_object) && super::detail_tables::allows(run, "aio")
}
