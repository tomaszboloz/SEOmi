use super::ctx::Ctx;
use super::model::findings;
use super::sections::build;
use serde_json::{json, Value};

fn previous_rows(previous: Value) -> Vec<(String, String)> {
    let audit = json!({"final_url": "u", "phrase_insights": {"phrase": "kawa", "sija": {
        "intent": "how-to", "match": "match", "ssas": 70, "analysed": 3, "requested": 5,
        "funnel": {"TOFU": 1, "MOFU": 1, "BOFU": 1}, "gaps": [], "previous": previous
    }}});
    let all = build(&Ctx {
        audit: &audit,
        findings: findings(&audit),
    });
    let section = all
        .iter()
        .find(|item| item.title.contains("SIJA"))
        .expect("sija");
    section
        .checks
        .iter()
        .map(|c| (c.name.clone(), c.value.clone()))
        .collect()
}

#[test]
fn previous_sija_run_is_listed_with_intent_ssas_and_pages() {
    let rows = previous_rows(
        json!({"runAt": "2026-10-13T17:30:39Z", "intent": "comparison", "ssas": 61.5, "analysed": 4}),
    );
    let row = rows
        .iter()
        .find(|row| row.0 == "Previous stored run")
        .expect("previous");
    assert_eq!(
        row.1,
        "2026-10-13 17:30 UTC: intent Comparison, SSAS 61.5, 4 pages rendered"
    );
}

#[test]
fn previous_sija_run_degrades_without_inventing_values() {
    let rows = previous_rows(json!({"intent": null, "ssas": null}));
    let row = rows
        .iter()
        .find(|row| row.0 == "Previous stored run")
        .expect("previous");
    assert_eq!(row.1, "—: intent None, SSAS —, 0 pages rendered");
    assert!(!previous_rows(json!("bad"))
        .iter()
        .any(|row| row.0 == "Previous stored run"));
}
