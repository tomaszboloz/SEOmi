//! IGOS rows of the phrase section (#68).

use super::{attention, count, label, method, num, of_total};
use crate::commands::pdf_report::audit_report::check::Check;
use crate::commands::pdf_report::audit_report::ctx::{field, format_number, list_at, pretty_time};
use crate::commands::pdf_report::audit_report::strings::phrase as p;
use crate::commands::pdf_report::audit_report::strings::{t, tf};
use crate::commands::pdf_report::layout::text::EMPTY;
use serde_json::Value;

pub(super) fn rows(igos: &Value) -> Vec<Check> {
    let score = num(igos, "/igos").map(format_number);
    let limits: Vec<String> = list_at(igos, "/limitations")
        .iter()
        .filter_map(Value::as_str)
        .map(|code| label("limit", code))
        .collect();
    let limits_text = if limits.is_empty() {
        t(p::NONE).to_owned()
    } else {
        limits.join("; ")
    };
    let mut rows = vec![match score {
        Some(value) => Check::info(t(p::SCORE), Some(value)),
        None => attention(t(p::SCORE), t(p::NO_SCORE).into(), limits_text.clone()),
    }];
    rows.push(Check::info(
        t(p::BASELINE),
        Some(of_total(igos, "/availableDocs", "/requestedDocs")),
    ));
    if igos.pointer("/components").is_some_and(Value::is_object) {
        let parts: Vec<String> = p::COMPONENT_ORDER
            .iter()
            .map(|key| {
                format!(
                    "{:.2}",
                    num(igos, &format!("/components/{key}")).unwrap_or(0.0)
                )
            })
            .collect();
        rows.push(Check::info(t(p::COMPONENTS), Some(parts.join(" / "))));
    }
    if let Some(coverage) = num(igos, "/coverage") {
        rows.push(Check::info(
            t(p::COVERAGE),
            Some(format!("{}%", format_number((coverage * 100.0).round()))),
        ));
    }
    let zones: Vec<String> = p::ZONE_ORDER
        .iter()
        .map(|zone| {
            format!(
                "{} {}",
                label("zone", zone),
                count(igos, &format!("/zones/{zone}"))
            )
        })
        .collect();
    rows.push(Check::info(t(p::ZONES), Some(zones.join(" · "))));
    for (zone, advice) in [("echo", p::ECHO_ADVICE), ("drift", p::DRIFT_ADVICE)] {
        let n = count(igos, &format!("/zones/{zone}"));
        if n != "0" {
            rows.push(attention(
                &label("zone", zone),
                n.clone(),
                tf(t(advice), &[&n]),
            ));
        }
    }
    if num(igos, "/components/edsi") == Some(0.0) {
        rows.push(attention(
            &label("component", "edsi"),
            "0.00".into(),
            t(p::EVIDENCE_ADVICE).into(),
        ));
    }
    rows.push(Check::info(
        t(p::NOVEL),
        Some(count(igos, "/novelEntities")),
    ));
    let run = [field(igos, "provider"), field(igos, "model")]
        .map(|part| part.unwrap_or_else(|| EMPTY.into()))
        .join(" / ");
    let at = field(igos, "runAt")
        .map(|raw| pretty_time(&raw))
        .unwrap_or_else(|| EMPTY.into());
    rows.push(Check::info(t(p::VECTORS), Some(format!("{run}, {at}"))));
    rows.push(Check::info(t(p::LIMITS), Some(limits_text)));
    rows.push(method());
    rows
}
