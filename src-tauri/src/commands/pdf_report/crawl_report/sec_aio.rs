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

fn profile_status(aio: &Value) -> String {
    field(aio, "profile_status").unwrap_or_else(|| {
        if aio.get("profile").is_some_and(Value::is_object) {
            "mismatch".to_owned()
        } else {
            "legacy-unversioned".to_owned()
        }
    })
}

fn profile_status_label(status: &str) -> String {
    match status {
        "persisted" => t(a::PROFILE_STATUS_PERSISTED).to_owned(),
        "legacy-unversioned" => t(a::PROFILE_STATUS_LEGACY).to_owned(),
        "mismatch" => t(a::PROFILE_STATUS_MISMATCH).to_owned(),
        _ => status.to_owned(),
    }
}

fn profile_facts(aio: &Value) -> ([(&'static str, String); 4], [(&'static str, String); 2]) {
    let profile = aio.get("profile").filter(|value| value.is_object());
    let status = profile_status(aio);
    (
        [
            (t(a::PROFILE), arg(profile.and_then(|value| value.get("id")))),
            (t(a::PROFILE_STATUS), profile_status_label(&status)),
            (
                t(a::ALGORITHM_VERSION),
                arg(profile.and_then(|value| value.get("algorithm_version"))),
            ),
            (
                t(a::CONFIG_HASH),
                arg(profile.and_then(|value| value.get("config_hash"))),
            ),
        ],
        [
            (
                t(a::LANGUAGE),
                arg(profile.and_then(|value| value.get("language"))),
            ),
            (
                t(a::MARKET),
                arg(profile.and_then(|value| value.get("market"))),
            ),
        ],
    )
}

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
        let (first_profile_row, second_profile_row) = profile_facts(aio);
        self.facts_row(&first_profile_row);
        self.facts_row(&second_profile_row);
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
        let unknown: Vec<&str> = list(aio, "unknown_reasons")
            .iter()
            .filter_map(Value::as_str)
            .filter(|reason| !reason.trim().is_empty())
            .collect();
        if !unknown.is_empty() {
            let reasons = format!("{}: {}", t(a::UNKNOWN_REASONS), unknown.join(", "));
            let note = tf(t(a::UNKNOWN_DISCLOSURE), &[&reasons]);
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
