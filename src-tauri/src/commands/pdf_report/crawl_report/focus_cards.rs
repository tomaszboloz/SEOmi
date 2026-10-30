//! "Site Focus" section pieces: KPI grid and core topic card.

use super::data::list;
use super::focus_text::{arg, percent};
use super::sec_focus::band_color;
use super::strings::focus::{self as f};
use super::strings::{t, tf};
use crate::commands::pdf_report::layout::card::{Card, CardRow};
use crate::commands::pdf_report::layout::color::{CRITICAL, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::widgets::Kpi;
use serde_json::Value;

pub fn count<'a>(focus: &'a Value, key: &str) -> Option<&'a Value> {
    focus.pointer(&format!("/counts/{key}"))
}

pub fn kpis(focus: &Value) -> Vec<Kpi> {
    let scored = arg(count(focus, "scored"));
    let item = |label, value: String, note: String, color| Kpi {
        label,
        value,
        note,
        color,
    };
    let plain = |label, key: &str, note| item(label, arg(count(focus, key)), t(note).into(), MUTED);
    vec![
        item(
            t(f::K_CONFIDENCE),
            percent(focus.get("confidence")),
            t(f::N_CONFIDENCE).into(),
            MUTED,
        ),
        item(
            t(f::K_ON_TOPIC),
            percent(focus.get("on_topic_ratio")),
            t(f::N_ON_TOPIC).into(),
            MUTED,
        ),
        item(
            t(f::K_SCORED),
            scored.clone(),
            tf(t(f::N_SCORED), &[&arg(focus.get("page_count"))]),
            MUTED,
        ),
        plain(t(f::K_SKIPPED), "skipped", f::N_SKIPPED),
        item(
            t(f::K_OFF_TOPIC),
            arg(count(focus, "off_topic")),
            t(f::N_OFF_TOPIC).into(),
            CRITICAL,
        ),
        item(
            t(f::K_BORDERLINE),
            arg(count(focus, "borderline")),
            t(f::N_BORDERLINE).into(),
            WARNING,
        ),
        item(
            t(f::K_STRONG),
            arg(count(focus, "strong")),
            t(f::N_STRONG).into(),
            OK,
        ),
    ]
}

pub fn core_card(focus: &Value) -> Card {
    let core = focus.get("core_topic").unwrap_or(&Value::Null);
    let band = focus
        .get("band")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let terms: Vec<String> = list(core, "terms")
        .iter()
        .map(|item| {
            tf(
                t(f::CORE_TERM),
                &[&arg(item.get("term")), &arg(item.get("coverage_pct"))],
            )
        })
        .collect();
    let meta = match core.get("manual_input") {
        Some(input) => tf(t(f::CORE_MANUAL), &[&arg(Some(input))]),
        None => t(f::CORE_DETECTED).into(),
    };
    Card {
        accent: band_color(band),
        badge: t(f::CORE_BADGE).into(),
        meta,
        tag: match focus.get("confidence").filter(|v| v.is_number()) {
            Some(value) => tf(t(f::CORE_CONFIDENCE), &[&arg(Some(value))]),
            None => arg(None),
        },
        headline: arg(core.get("label")),
        rows: vec![CardRow {
            label: t(f::CORE_TERMS).into(),
            items: terms,
        }],
    }
}
