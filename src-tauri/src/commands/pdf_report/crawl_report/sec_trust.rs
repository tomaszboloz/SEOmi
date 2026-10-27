//! "Entity Trust" section: score card, layer KPIs, YMYL note and detail tables.

use super::data::list;
use super::focus_text::{arg, coded};
use super::strings::trust::{self as k, LEVEL, YMYL};
use super::strings::{t, tf};
use super::trust_tables as tables;
use crate::commands::pdf_report::layout::color::{Rgb, CRITICAL, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::doc::{Doc, CONTENT_W, MARGIN};
use crate::commands::pdf_report::layout::text::Style;
use crate::commands::pdf_report::layout::widgets::Kpi;
use serde_json::Value;

const AMBER: Rgb = Rgb(0xCA, 0x8A, 0x04);

/// Colour of a trust level: green, amber, orange, red.
pub fn level_color(level: &str) -> Rgb {
    match level {
        "strong" => OK,
        "adequate" => AMBER,
        "weak" => WARNING,
        "critical" => CRITICAL,
        _ => MUTED,
    }
}

fn layer(trust: &Value, key: &str) -> Option<f64> {
    trust
        .pointer(&format!("/layers/{key}"))
        .and_then(Value::as_f64)
}

/// One KPI per layer; a layer without data shows a dash and says why.
pub fn kpis(trust: &Value) -> Vec<Kpi> {
    let count = |key: &str| arg(trust.pointer(&format!("/counts/{key}")));
    let item = |label, key: &str| {
        let value = layer(trust, key);
        Kpi {
            label,
            value: value.map_or_else(|| arg(None), |v| arg(Some(&Value::from(v)))),
            note: t(if value.is_some() {
                k::N_LAYER
            } else {
                k::N_NO_DATA
            })
            .into(),
            color: value.map_or(MUTED, |v| level_color(level_of(v))),
        }
    };
    vec![
        item(t(k::K_SCHEMA), "schema_graph"),
        item(t(k::K_AUTHOR), "author_alignment"),
        item(t(k::K_CITATION), "citation_quality"),
        item(t(k::K_TRANSPARENCY), "transparency"),
        Kpi {
            label: t(k::K_ARTICLES),
            value: arg(trust.get("article_count")),
            note: tf(t(k::N_ARTICLES), &[&arg(trust.get("page_count"))]),
            color: MUTED,
        },
        Kpi {
            label: t(k::K_AUTHORS),
            value: count("authors"),
            note: tf(t(k::N_AUTHORS), &[&count("authors_with_same_as")]),
            color: MUTED,
        },
    ]
}

fn level_of(score: f64) -> &'static str {
    match score {
        s if s >= 75.0 => "strong",
        s if s >= 60.0 => "adequate",
        s if s >= 40.0 => "weak",
        _ => "critical",
    }
}

impl Doc {
    /// Entity Trust section built from the `trust` summary of a crawl run.
    pub fn crawl_trust(&mut self, trust: &Value) {
        self.heading(t(k::TITLE));
        self.paragraph(MARGIN, CONTENT_W, Style::CAPTION, t(k::INTRO));
        self.skip(6.0);
        let level = trust
            .get("level")
            .and_then(Value::as_str)
            .unwrap_or_default();
        self.ensure(90.0);
        self.score_panel_colored(
            level_color(level),
            trust.get("score").and_then(Value::as_f64),
            &coded(LEVEL, level, &[]),
            t(k::SCORE_TITLE),
            t(k::LEGEND),
        );
        self.kpi_grid(&kpis(trust));
        if let Some(category) = trust.get("ymyl").and_then(Value::as_str) {
            let note = tf(
                t(k::YMYL_NOTE),
                &[
                    &coded(YMYL, category, &[]),
                    &arg(trust.get("ymyl_unattributed_pct")),
                ],
            );
            self.paragraph(MARGIN, CONTENT_W, Style::BODY.colored(WARNING), &note);
        }
        self.skip(6.0);
        self.data_table(&tables::findings(trust));
        if !list(trust, "authors").is_empty() {
            self.data_table(&tables::authors(trust));
        }
        self.data_table(&tables::pages(trust));
    }
}

/// Whether the run carries a trust summary the template allows.
pub fn present(run: &Value) -> bool {
    run.get("trust").is_some_and(Value::is_object) && super::detail_tables::allows(run, "trust")
}
