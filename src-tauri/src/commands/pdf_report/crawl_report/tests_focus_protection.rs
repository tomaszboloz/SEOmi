use super::focus_protection::protection;
use super::strings::protection::{ALL, CODES};
use super::tests::text_of;
use super::tests_focus::{focus, with_focus};
use crate::commands::pdf_report::labels::default_keys;
use serde_json::{json, Value};

fn guarded(telemetry: bool) -> Value {
    let mut summary = focus();
    summary["protection"] = json!({
        "telemetry": telemetry, "trs_threshold": 40, "pri_threshold": 0.15,
        "rows": [{
            "url": "https://shop.example.test/cookies", "trs": 12, "decision": "prune-candidate", "pri": 0,
            "reasons": ["low-pri-measured"],
            "evidence": [
                {"signal": "clicks", "state": "measured", "value": 0},
                {"signal": "referringDomains", "state": "unavailable", "value": null},
                {"signal": "revenue", "state": "measured", "value": 5, "currency": "PLN"}
            ],
            "advice": [{"code": "redirect-301-to-relevant-target", "conditions": ["relevant-target-same-intent", "no-measured-value"]}]
        }]
    });
    summary
}

#[test]
fn table_keeps_reasons_unknown_evidence_and_conditions() {
    let table = protection(&guarded(true)).expect("table");
    assert_eq!(table.rows.len(), 1);
    let cells: Vec<&str> = table.rows[0]
        .iter()
        .map(|cell| cell.text.as_str())
        .collect();
    assert!(cells[2].contains("Review for pruning"), "{}", cells[2]);
    assert!(cells[2].contains("Measured signals are low"));
    assert!(cells[3].contains("Clicks: 0 (Measured)"), "{}", cells[3]);
    assert!(cells[3].contains("Referring domains: unknown (Unavailable)"));
    assert!(cells[3].contains("5 PLN"));
    assert!(
        cells[4].contains("301 to a relevant page only if: the target answers the same intent"),
        "{}",
        cells[4]
    );
    assert!(table
        .intro
        .as_deref()
        .unwrap_or_default()
        .contains("ties count as protected"));
    assert!(!table
        .intro
        .as_deref()
        .unwrap_or_default()
        .contains("No GSC"));
}

#[test]
fn missing_telemetry_is_stated_and_absent_block_prints_nothing() {
    let intro = protection(&guarded(false))
        .and_then(|table| table.intro)
        .unwrap_or_default();
    assert!(intro.contains("No GSC, GA4 or backlink data"));
    assert!(protection(&focus()).is_none());
    let mut empty = focus();
    empty["protection"] = json!({"telemetry": true, "rows": []});
    assert!(protection(&empty).is_none());
}

#[test]
fn pdf_prints_the_protection_table_inside_site_focus() {
    let text = text_of(&with_focus(guarded(true)));
    assert!(text.contains("URL protection check"));
    assert!(text.contains("shop.example.test/cookies"));
}

#[test]
fn every_protection_label_key_exists_in_english() {
    let known = default_keys();
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    for (prefix, codes) in CODES {
        keys.extend(codes.iter().map(|code| format!("{prefix}.{code}")));
    }
    let missing: Vec<_> = keys
        .iter()
        .filter(|key| !known.contains(&key.as_str()))
        .collect();
    assert!(missing.is_empty(), "missing in en.json: {missing:?}");
}
