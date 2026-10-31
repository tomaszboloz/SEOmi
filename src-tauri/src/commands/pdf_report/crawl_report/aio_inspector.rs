//! Passage inspector table of the AI readiness section (#64): score components,
//! position in the section text and the first detected subject-predicate-object facts.

use super::aio_tables::percent;
use super::data::{list, page_url};
use super::focus_text::arg;
use super::strings::aio as a;
use super::strings::{t, tf};
use super::tables::Table;
use crate::commands::pdf_report::layout::text::{dash, EMPTY};
use serde_json::Value;

/// Inspector fields exist only in summaries produced by the 0.7+ engine.
fn has_evidence(passage: &Value) -> bool {
    [
        "self_containment",
        "spo_density",
        "answer_first",
        "offset_start",
        "facts",
    ]
    .iter()
    .any(|key| passage.get(*key).is_some_and(|value| !value.is_null()))
}

fn component(value: Option<&Value>) -> String {
    match value {
        Some(number @ Value::Number(_)) => percent(Some(number)),
        _ => EMPTY.to_owned(),
    }
}

fn answer_first(passage: &Value) -> String {
    if passage.get("answer_first_applicable") == Some(&Value::Bool(false)) {
        return t(a::NOT_APPLICABLE).to_owned();
    }
    component(passage.get("answer_first"))
}

fn position(passage: &Value) -> String {
    match (passage.get("offset_start"), passage.get("offset_end")) {
        (Some(start @ Value::Number(_)), Some(end @ Value::Number(_))) => {
            tf(a::POSITION, &[&arg(Some(start)), &arg(Some(end))])
        }
        _ => EMPTY.to_owned(),
    }
}

fn facts(passage: &Value) -> String {
    let shown: Vec<String> = list(passage, "facts")
        .iter()
        .map(|fact| {
            let triple = ["subject", "predicate", "object"]
                .iter()
                .map(|key| arg(fact.get(*key)))
                .collect::<Vec<_>>()
                .join(" · ");
            if fact.get("negated") == Some(&Value::Bool(true)) {
                tf(a::NEGATED, &[&triple])
            } else {
                triple
            }
        })
        .collect();
    if shown.is_empty() {
        t(a::NO_FACTS_FOUND).to_owned()
    } else {
        shown.join("; ")
    }
}

/// Inspector table, or `None` when no passage carries inspector evidence (older summaries).
pub fn inspector_table(aio: &Value) -> Option<Table> {
    let rows: Vec<Vec<String>> = list(aio, "passages")
        .iter()
        .filter(|passage| has_evidence(passage))
        .map(|passage| {
            vec![
                format!(
                    "{} {}",
                    dash(&page_url(passage)),
                    arg(passage.get("heading"))
                ),
                position(passage),
                component(passage.get("self_containment")),
                component(passage.get("spo_density")),
                answer_first(passage),
                facts(passage),
            ]
        })
        .collect();
    if rows.is_empty() {
        return None;
    }
    let columns = [
        (t(a::COL_HEADING), 24.0),
        (t(a::COL_POSITION), 12.0),
        (t(a::COL_SELF), 12.0),
        (t(a::COL_SPO), 10.0),
        (t(a::COL_ANSWER), 12.0),
        (t(a::COL_FACTS_FOUND), 30.0),
    ];
    Some(Table::text(
        t(a::T_INSPECTOR),
        Some(t(a::INSPECTOR_INTRO).into()),
        &columns,
        rows,
    ))
}
