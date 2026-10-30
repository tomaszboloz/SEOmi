use super::check::{Section, Status};
use super::ctx::Ctx;
use super::model::findings;
use super::sections::build;
use serde_json::{json, Value};

fn sections(audit: &Value) -> Vec<Section> {
    build(&Ctx {
        audit,
        findings: findings(audit),
    })
}

fn rows<'a>(sections: &'a [Section], title: &str) -> Vec<(&'a str, &'a str, Status, &'a str)> {
    let section = sections
        .iter()
        .find(|item| item.title == title)
        .expect(title);
    section
        .checks
        .iter()
        .map(|c| {
            (
                c.name.as_str(),
                c.value.as_str(),
                c.status,
                c.advice.as_str(),
            )
        })
        .collect()
}

fn insights() -> Value {
    json!({"final_url": "u", "phrase_insights": {"phrase": "kawa", "igos": {
        "igos": 42, "status": "partial", "components": {"nefr": 0.4, "edsi": 0, "fhem": 0.25, "sdd": 0.123},
        "coverage": 0.666, "availableDocs": 4, "requestedDocs": 10, "zones": {"echo": 2, "gain": 3, "drift": 0, "neutral": 1},
        "novelEntities": 5, "provider": "ollama", "model": "nomic", "runAt": "2026-10-13T17:30:39Z",
        "limitations": ["some-documents-missing", "custom-code"]
    }, "sija": {
        "intent": "how-to", "serpIntent": "comparison", "match": "mismatch", "ssas": null, "ssasStatus": "inconclusive",
        "analysed": 2, "requested": 5, "funnel": {"TOFU": 1, "MOFU": 1, "BOFU": 0}, "gaps": [{"format": "table", "topPages": 2, "analysed": 2}]
    }}})
}

#[test]
fn igos_section_renders_numbers_zones_advice_and_localised_limits() {
    let all = sections(&insights());
    let igos = rows(&all, "Information gain (IGOS) for \"kawa\"");
    assert_eq!(igos[0], ("Score", "42", Status::Info, "—"));
    assert!(igos.contains(&("Compared TOP pages", "4 of 10", Status::Info, "—")));
    assert!(igos
        .iter()
        .any(|row| row.0 == "Components (NEFR / EDSI / FHEM / SDD)"
            && row.1 == "0.40 / 0.00 / 0.25 / 0.12"));
    assert!(igos
        .iter()
        .any(|row| row.0 == "Baseline coverage" && row.1 == "67%"));
    assert!(igos
        .iter()
        .any(|row| row.0 == "Paragraph zones" && row.1 == "Echo 2 · Gain 3 · Drift 0 · Neutral 1"));
    assert!(igos
        .iter()
        .any(|row| row.0 == "Echo" && row.2 == Status::Attention && row.3.contains('2')));
    assert!(!igos.iter().any(|row| row.0 == "Drift"));
    assert!(igos
        .iter()
        .any(|row| row.2 == Status::Attention && row.1 == "0.00"));
    assert!(igos
        .iter()
        .any(|row| row.0 == "Vectors (provider / model, run)"
            && row.1 == "ollama / nomic, 2026-10-13 17:30 UTC"));
    let limits = igos.iter().find(|row| row.0 == "Limitations").unwrap();
    assert!(limits.1.ends_with("; custom-code") && !limits.1.starts_with("some-documents-missing"));
}

#[test]
fn sija_section_flags_mismatch_inconclusive_ssas_and_gaps() {
    let all = sections(&insights());
    let sija = rows(&all, "Search intent (SIJA) for \"kawa\"");
    assert_eq!(sija[0].1, "How-to");
    assert_eq!(sija[1].1, "Comparison");
    assert_eq!(
        (sija[2].1, sija[2].2),
        ("Does not match", Status::Attention)
    );
    assert!(sija[3].1.contains('2'));
    assert!(sija
        .iter()
        .any(|row| row.1 == "2 of 5 rendered: TOFU 1 · MOFU 1 · BOFU 0"));
    assert!(sija.iter().any(|row| row.0 == "Missing formats"
        && row.1 == "2 of 2"
        && row.3.contains("2 of 2 TOP pages")));
}

#[test]
fn missing_score_parts_and_empty_insights_degrade_without_inventing_values() {
    let audit = json!({"final_url": "u", "phrase_insights": {"phrase": "x",
        "igos": {"igos": null, "components": null, "limitations": []},
        "sija": {"intent": null, "match": "match", "ssas": 61.5, "gaps": []}}});
    let all = sections(&audit);
    let igos = rows(&all, "Information gain (IGOS) for \"x\"");
    assert_eq!(
        (igos[0].1, igos[0].2, igos[0].3),
        ("No score", Status::Attention, "None")
    );
    assert!(!igos
        .iter()
        .any(|row| row.0.starts_with("Components") || row.0 == "Baseline coverage"));
    assert!(igos
        .iter()
        .any(|row| row.0 == "Vectors (provider / model, run)" && row.1 == "— / —, —"));
    let sija = rows(&all, "Search intent (SIJA) for \"x\"");
    assert_eq!(
        (sija[0].1, sija[2].1, sija[2].2, sija[3].1),
        ("None", "Matches", Status::Info, "61.5")
    );
    assert!(sija
        .iter()
        .any(|row| row.0 == "Missing formats" && row.2 == Status::Ok));
    for audit in [
        json!({"final_url": "u"}),
        json!({"final_url": "u", "phrase_insights": "bad"}),
        json!({"final_url": "u", "phrase_insights": {"igos": 1}}),
    ] {
        assert!(sections(&audit)
            .iter()
            .all(|item| !item.title.contains("IGOS") && !item.title.contains("SIJA")));
    }
}

#[test]
fn generated_pdf_contains_the_phrase_sections() {
    use base64::Engine;
    let encoded = crate::commands::pdf_report::generate_audit_pdf(insights()).unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap();
    assert!(crate::commands::pdf_report::tests::pdf_has_text(
        &bytes,
        "SSAS (structure vs TOP)"
    ));
}
