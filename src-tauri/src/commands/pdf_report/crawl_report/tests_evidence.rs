use super::fixture::synthetic;
use super::sec_evidence::present;
use super::strings::evidence::{self as e, ALL};
use super::tests::text_of;
use serde_json::{json, Value};

fn evidence() -> Value {
    json!({
        "revenue": {"currency": "PLN", "attribution": "ga4-session-landing-page", "period": "2026-01-01 – 2026-03-31",
            "pages": [{"page": "/a", "revenue": 1250.5}, {"page": "/b", "revenue": 0}]},
        "experiments": [
            {"target": "https://shop.test/p", "date": "2026-03-18", "method": "structural", "status": "estimated", "effect": 350.4, "lower": 120.0, "upper": 590.0, "probability": 0.97},
            {"target": "site", "date": "2026-03-01", "method": "regression", "status": "not-estimable", "effect": null, "lower": null, "upper": null, "probability": null},
            {"target": "x", "date": "2026-03-02", "method": "future-method", "status": "estimated", "effect": 1.0, "lower": null, "upper": 2.0, "probability": 0.5}
        ],
        "decay": [
            {"query": "buty", "verdict": "alert", "samples": 4, "centroid_shift": 0.1234, "new_entities": 3, "lost_entities": 1},
            {"query": "kurtki", "verdict": "unknown-verdict", "samples": 1, "centroid_shift": null, "new_entities": 0, "lost_entities": 0}
        ]
    })
}
fn run(data: Value) -> Value {
    let mut run = synthetic(0);
    run["evidence"] = data;
    run
}

#[test]
fn evidence_section_renders_revenue_experiments_and_drift_with_the_fixed_disclaimer() {
    let text = text_of(&run(evidence()));
    for part in [
        "Telemetry, experiments and SERP drift",
        "Organic revenue per landing page",
        "Currency PLN",
        "ga4-session-landing-page",
        "2026-01-01 – 2026-03-31",
        "/a",
        "1250.5",
        "Experiment estimates",
        "Seasonal",
        "structural",
        "Estimated",
        "+350",
        "+590]",
        "97%",
        "estimable",
        "n/a",
        "future-method",
        "SERP drift history",
        "buty",
        "Review",
        "suggested",
        "0.123",
        "+3",
        "unknown-verdict",
        "Not Google data",
        "never as zero",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
}

#[test]
fn evidence_blocks_are_independent_and_the_section_follows_the_template() {
    let only_revenue = text_of(&run(json!({"revenue": evidence()["revenue"].clone()})));
    assert!(only_revenue.contains("Organic revenue per landing page"));
    assert!(
        !only_revenue.contains("Experiment estimates")
            && !only_revenue.contains("SERP drift history")
    );
    let no_period = text_of(&run(
        json!({"revenue": {"currency": "EUR", "attribution": "a", "pages": []}}),
    ));
    assert!(no_period.contains("period n/a"));
    for absent in [Value::Null, json!("x"), json!([])] {
        assert!(!present(&run(absent)));
    }
    assert!(!text_of(&synthetic(0)).contains("SERP drift history"));
    let mut excluded = run(evidence());
    excluded["report_template_sections"] = json!(["summary"]);
    assert!(!present(&excluded));
}

#[test]
fn every_evidence_label_exists_in_all_twelve_pdf_languages() {
    let mut keys: Vec<String> = ALL.iter().map(|key| (*key).to_owned()).collect();
    keys.extend(
        ["estimated", "not-estimable"]
            .iter()
            .map(|code| format!("{}.{code}", e::STATUS)),
    );
    keys.extend(
        [
            "too-few-samples",
            "incompatible",
            "stable",
            "not-persistent",
            "cooldown",
            "alert",
        ]
        .iter()
        .map(|code| format!("{}.{code}", e::VERDICT)),
    );
    keys.extend(
        ["regression", "structural"]
            .iter()
            .map(|code| format!("{}.{code}", e::METHOD)),
    );
    for language in [
        "en", "pl", "de", "es", "fr", "it", "pt", "ru", "ar", "ja", "ko", "zh",
    ] {
        let path = format!(
            "{}/../src/i18n/locales/{language}.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let bundle: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        for key in &keys {
            let pointer = format!("/pdfReport/{}", key.replace('.', "/"));
            assert!(
                bundle
                    .pointer(&pointer)
                    .and_then(Value::as_str)
                    .is_some_and(|text| !text.is_empty()),
                "{language}: {key}"
            );
        }
    }
}
