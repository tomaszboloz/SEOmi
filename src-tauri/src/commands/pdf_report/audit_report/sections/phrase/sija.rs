//! SIJA rows of the phrase section (#69).

use super::{attention, count, label, method, num, of_total};
use crate::commands::pdf_report::audit_report::check::{Check, Status};
use crate::commands::pdf_report::audit_report::ctx::{field, format_number, list_at, pretty_time};
use crate::commands::pdf_report::audit_report::strings::phrase as p;
use crate::commands::pdf_report::audit_report::strings::{report as s, t, tf};
use crate::commands::pdf_report::layout::text::EMPTY;
use serde_json::Value;

pub(super) fn rows(sija: &Value) -> Vec<Check> {
    let intent = |key: &str| {
        field(sija, key).map_or_else(|| t(p::NONE).to_owned(), |code| label("intent", &code))
    };
    let matched = field(sija, "match").unwrap_or_else(|| "unknown".into());
    let mut rows = vec![
        Check::info(t(p::PAGE_INTENT), Some(intent("intent"))),
        Check::info(t(p::SERP_INTENT), Some(intent("serpIntent"))),
        if matched == "mismatch" {
            attention(
                t(p::MATCH),
                label("matchValue", &matched),
                t(p::MISMATCH_ADVICE).into(),
            )
        } else {
            Check::info(t(p::MATCH), Some(label("matchValue", &matched)))
        },
        match num(sija, "/ssas") {
            Some(score) => Check::info(t(p::SSAS), Some(format_number(score))),
            None => Check::info(
                t(p::SSAS),
                Some(tf(t(p::INCONCLUSIVE), &[&count(sija, "/analysed")])),
            ),
        },
    ];
    let funnel = [
        "/analysed",
        "/requested",
        "/funnel/TOFU",
        "/funnel/MOFU",
        "/funnel/BOFU",
    ]
    .map(|key| count(sija, key));
    rows.push(Check::info(
        t(p::FUNNEL),
        Some(tf(
            t(p::FUNNEL_VALUE),
            &funnel.each_ref().map(String::as_str),
        )),
    ));
    if let Some(previous) = sija.get("previous").filter(|value| value.is_object()) {
        let at = field(previous, "runAt").map_or_else(|| EMPTY.into(), |raw| pretty_time(&raw));
        let ssas = num(previous, "/ssas").map_or_else(|| EMPTY.into(), format_number);
        let prior = field(previous, "intent")
            .map_or_else(|| t(p::NONE).to_owned(), |code| label("intent", &code));
        rows.push(Check::info(
            t(p::PREVIOUS),
            Some(tf(
                t(p::PREVIOUS_VALUE),
                &[&at, &prior, &ssas, &count(previous, "/analysed")],
            )),
        ));
    }
    let gaps = list_at(sija, "/gaps");
    if gaps.is_empty() {
        rows.push(Check::new(
            t(p::GAPS),
            Some(t(p::NONE).into()),
            Status::Ok,
            t(s::NO_ACTION),
        ));
    }
    for gap in gaps {
        let code = field(gap, "format").unwrap_or_default();
        let advice = tf(
            &label("gap", &code),
            &[&count(gap, "/topPages"), &count(gap, "/analysed")],
        );
        rows.push(attention(
            t(p::GAPS),
            of_total(gap, "/topPages", "/analysed"),
            advice,
        ));
    }
    rows.push(method());
    rows
}
