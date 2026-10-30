//! Phrase sections (#68 IGOS, #69 SIJA): figures the app attached as `phrase_insights`.
//! Only numbers and codes are rendered; competitor text never reaches the report.

mod igos;
mod sija;

use super::super::check::{Check, Section, Status};
use super::super::ctx::{field, format_number, Ctx};
use super::super::strings::phrase as p;
use super::super::strings::{t, tf};
use serde_json::Value;

pub(super) fn label(group: &str, code: &str) -> String {
    let key = format!("audit.phrase.{group}.{code}");
    let text = t(&key);
    if text == key {
        code.to_owned()
    } else {
        text.to_owned()
    }
}

pub(super) fn num(value: &Value, pointer: &str) -> Option<f64> {
    value
        .pointer(pointer)?
        .as_f64()
        .filter(|number| number.is_finite())
}

pub(super) fn count(value: &Value, pointer: &str) -> String {
    num(value, pointer).map_or_else(|| "0".into(), format_number)
}

pub(super) fn of_total(value: &Value, part: &str, total: &str) -> String {
    tf(t(p::OF_TOTAL), &[&count(value, part), &count(value, total)])
}

pub(super) fn attention(name: &str, value: String, advice: String) -> Check {
    Check::new(name, Some(value), Status::Attention, &advice)
}

pub(super) fn method() -> Check {
    Check::info(t(p::METHOD_LABEL), Some(t(p::METHOD).into()))
}

/// IGOS and SIJA sections for the audited phrase; absent parts add nothing.
pub fn sections(ctx: &Ctx) -> Vec<Section> {
    let Some(insights) = ctx
        .audit
        .get("phrase_insights")
        .filter(|value| value.is_object())
    else {
        return Vec::new();
    };
    let phrase = field(insights, "phrase").unwrap_or_default();
    let mut out = Vec::new();
    if let Some(igos) = insights.get("igos").filter(|value| value.is_object()) {
        out.push(Section {
            title: tf(t(p::IGOS_TITLE), &[&phrase]),
            checks: igos::rows(igos),
        });
    }
    if let Some(sija) = insights.get("sija").filter(|value| value.is_object()) {
        out.push(Section {
            title: tf(t(p::SIJA_TITLE), &[&phrase]),
            checks: sija::rows(sija),
        });
    }
    out
}
